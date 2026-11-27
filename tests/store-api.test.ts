// Run with `node --test "tests/**/*.test.ts"` (Node's built-in test runner).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getWooServerConfig,
  parseCheckoutBody,
  validateCheckoutRequest,
} from "../lib/woo/server.ts";

const STAGING_ORIGIN = "https://regionaltest.shop.marianascoffee.com";

const MOCK_PRODUCTS = [
  {
    id: 101,
    name: "Mt. Tapochao Roast",
    slug: "mt-tapochao-roast",
    prices: { price: "2400", currency_code: "USD", currency_minor_unit: 2 },
    is_purchasable: true,
    is_in_stock: true,
    add_to_cart: { maximum: 5 },
  },
  {
    id: 102,
    name: "Colombian Roast",
    slug: "colombian-roast",
    prices: { price: "2600", currency_code: "USD", currency_minor_unit: 2 },
    is_purchasable: true,
    is_in_stock: true,
    add_to_cart: { maximum: 10 },
  },
  {
    id: 103,
    name: "Sold Out Blend",
    slug: "sold-out-blend",
    prices: { price: "2800", currency_code: "USD", currency_minor_unit: 2 },
    is_purchasable: true,
    is_in_stock: false,
  },
  {
    id: 104,
    name: "Unpriced Draft",
    slug: "unpriced-draft",
    prices: { price: "", currency_code: "USD", currency_minor_unit: 2 },
    is_purchasable: true,
    is_in_stock: true,
  },
];

function mockStoreFetch(payload: unknown = MOCK_PRODUCTS, status = 200): typeof fetch {
  return async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
}

// --- Server config ---

test("getWooServerConfig reads Basic Auth only when both credentials are present and clamps timeout", () => {
  const withAuth = getWooServerConfig({
    WOOCOMMERCE_URL: `${STAGING_ORIGIN}/`,
    WOOCOMMERCE_STAGING_USER: "staging",
    WOOCOMMERCE_STAGING_PASS: "synthetic-pass",
    WOOCOMMERCE_FETCH_TIMEOUT_MS: "999999",
  });
  assert.equal(withAuth.shopOrigin, STAGING_ORIGIN);
  assert.deepEqual(withAuth.basicAuth, { username: "staging", password: "synthetic-pass" });
  assert.equal(withAuth.timeoutMs, 15_000);

  const partialAuth = getWooServerConfig({
    WOOCOMMERCE_URL: STAGING_ORIGIN,
    WOOCOMMERCE_STAGING_USER: "staging",
    WOOCOMMERCE_STAGING_PASS: "",
    WOOCOMMERCE_FETCH_TIMEOUT_MS: "50",
  });
  assert.equal(partialAuth.basicAuth, null);
  assert.equal(partialAuth.timeoutMs, 1000);
});

// --- Checkout payload parsing ---

test("parseCheckoutBody accepts valid IDs and quantities and merges duplicate lines safely", () => {
  const parsed = parseCheckoutBody({
    items: [
      { productId: 101, quantity: 2 },
      { productId: 101, quantity: 1 },
      { productId: 102, quantity: 3 },
    ],
    locale: "ja",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.locale, "ja");
    assert.deepEqual(parsed.data.items, [
      { productId: 101, quantity: 3 },
      { productId: 102, quantity: 3 },
    ]);
  }
});

test("parseCheckoutBody rejects client-supplied prices, unexpected fields, and invalid items", () => {
  assert.deepEqual(
    parseCheckoutBody({ items: [{ productId: 101, quantity: 1, price: 1 }] }),
    { ok: false, error: "unexpected_fields" },
  );
  assert.deepEqual(
    parseCheckoutBody({ items: [{ productId: 101, quantity: 1 }], total: 100 }),
    { ok: false, error: "unexpected_fields" },
  );
  assert.deepEqual(parseCheckoutBody({ items: [] }), { ok: false, error: "empty_cart" });
  assert.deepEqual(
    parseCheckoutBody({ items: [{ productId: -1, quantity: 1 }] }),
    { ok: false, error: "invalid_item" },
  );
  assert.deepEqual(
    parseCheckoutBody({ items: [{ productId: 101, quantity: 0 }] }),
    { ok: false, error: "invalid_item" },
  );
  assert.deepEqual(
    parseCheckoutBody({ items: [{ productId: 101, quantity: 21 }] }),
    { ok: false, error: "quantity_exceeded" },
  );
  assert.deepEqual(
    parseCheckoutBody({
      items: Array.from({ length: 21 }, (_, idx) => ({ productId: idx + 1, quantity: 1 })),
    }),
    { ok: false, error: "too_many_items" },
  );
});

// --- Server-side WooCommerce revalidation ---

test("validateCheckoutRequest returns validated single-item and multi-item handoff URLs with WooCommerce pricing", async () => {
  const config = { shopOrigin: STAGING_ORIGIN, basicAuth: null, timeoutMs: 5000 };

  const single = await validateCheckoutRequest(
    { items: [{ productId: 101, quantity: 2 }], locale: "ko" },
    { config, fetchImpl: mockStoreFetch() },
  );
  assert.equal(single.ok, true);
  if (single.ok) {
    assert.equal(single.locale, "ko");
    assert.equal(single.checkoutUrl, `${STAGING_ORIGIN}/checkout/?add-to-cart=101&quantity=2&lang=ko`);
    assert.equal(single.summary.totalQuantity, 2);
    assert.equal(single.summary.subtotalMinor, 4800);
    assert.equal(single.summary.items[0].unitPriceMinor, 2400);
    assert.equal(single.summary.items[0].lineTotalMinor, 4800);
  }

  const multi = await validateCheckoutRequest(
    {
      items: [
        { productId: 101, quantity: 1 },
        { productId: 102, quantity: 2 },
      ],
      locale: "zh",
    },
    { config, fetchImpl: mockStoreFetch() },
  );
  assert.equal(multi.ok, true);
  if (multi.ok) {
    assert.equal(multi.checkoutUrl, `${STAGING_ORIGIN}/checkout/?mc_cart=101%3A1%2C102%3A2&lang=zh`);
    assert.equal(multi.summary.totalQuantity, 3);
    assert.equal(multi.summary.subtotalMinor, 7600);
    assert.equal(multi.summary.currencyCode, "USD");
  }
});

test("validateCheckoutRequest rejects unavailable, unpriced, missing, and over-stock items with 409", async () => {
  const config = { shopOrigin: STAGING_ORIGIN, basicAuth: null, timeoutMs: 5000 };

  const res = await validateCheckoutRequest(
    {
      items: [
        { productId: 101, quantity: 6 }, // exceeds product max (5)
        { productId: 103, quantity: 1 }, // out of stock
        { productId: 104, quantity: 1 }, // unpriced
        { productId: 999, quantity: 1 }, // missing
      ],
      locale: "en",
    },
    { config, fetchImpl: mockStoreFetch() },
  );

  assert.equal(res.ok, false);
  if (!res.ok && res.status === 409) {
    assert.equal(res.error, "items_unavailable");
    assert.deepEqual(res.unavailableProductIds, [103, 104, 999]);
    assert.deepEqual(res.exceededProductIds, [101]);
  } else {
    assert.fail("expected 409 items_unavailable");
  }
});

test("validateCheckoutRequest fails cleanly when WooCommerce is unreachable or returns an error", async () => {
  const config = { shopOrigin: STAGING_ORIGIN, basicAuth: null, timeoutMs: 5000 };

  const httpFail = await validateCheckoutRequest(
    { items: [{ productId: 101, quantity: 1 }] },
    { config, fetchImpl: mockStoreFetch({ message: "Unauthorized" }, 401) },
  );
  assert.deepEqual(httpFail, { ok: false, status: 502, error: "store_unavailable" });

  const netFail = await validateCheckoutRequest(
    { items: [{ productId: 101, quantity: 1 }] },
    {
      config,
      fetchImpl: async () => {
        throw new Error("timeout");
      },
    },
  );
  assert.deepEqual(netFail, { ok: false, status: 502, error: "store_unavailable" });
});
