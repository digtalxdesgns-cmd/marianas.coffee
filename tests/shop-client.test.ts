// Run with `node --test "tests/**/*.test.ts"` (Node's built-in test runner).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyCheckoutConflictToCart,
  buildCheckoutPayload,
  isSafeCheckoutRedirectUrl,
  parseCheckoutResponse,
  parseStoreProductsResponse,
} from "../lib/woo/client.ts";
import { SUPPORTED_LOCALES } from "../lib/woo/config.ts";
import { parseWooProductsPayload } from "../lib/woo/products.ts";
import { shopTranslations } from "../app/shop/shopTranslations.ts";

const STAGING_ORIGIN = "https://regionaltest.shop.marianascoffee.com";

test("buildCheckoutPayload strips any client prices or extra fields and normalizes locale", () => {
  const dirty = [
    { productId: 101, quantity: 2, price: 1, priceMinor: 1 } as unknown as {
      productId: number;
      quantity: number;
    },
    { productId: 102, quantity: 1 },
  ];
  const payload = buildCheckoutPayload(dirty, "ja");
  assert.deepEqual(payload, {
    items: [
      { productId: 101, quantity: 2 },
      { productId: 102, quantity: 1 },
    ],
    locale: "ja",
  });
  assert.deepEqual(Object.keys(payload.items[0]), ["productId", "quantity"]);
});

test("parseStoreProductsResponse handles valid responses, rate limits, and errors", () => {
  const valid = parseStoreProductsResponse(200, {
    ok: true,
    locale: "ko",
    products: [
      {
        id: 101,
        slug: "mt-tapochao-roast",
        name: "Mt. Tapochao Roast",
        sku: "",
        shortDescription: "",
        permalink: null,
        image: null,
        priceMinor: 2400,
        currencyCode: "USD",
        currencyMinorUnit: 2,
        formattedPrice: "$24.00",
        availability: "in_stock",
        canPurchase: true,
        maxQuantity: 10,
      },
      { id: -5, name: "Invalid" }, // filtered out
    ],
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.locale, "ko");
    assert.equal(valid.products.length, 1);
  }

  assert.deepEqual(parseStoreProductsResponse(429, { ok: false }), {
    ok: false,
    error: "rate_limited",
  });
  assert.deepEqual(parseStoreProductsResponse(502, { ok: false }), {
    ok: false,
    error: "store_unavailable",
  });
  assert.deepEqual(parseStoreProductsResponse(200, { ok: false }), {
    ok: false,
    error: "invalid_response",
  });
});

test("isSafeCheckoutRedirectUrl allows only validated HTTPS/localhost /checkout/ URLs", () => {
  assert.equal(
    isSafeCheckoutRedirectUrl(`${STAGING_ORIGIN}/checkout/?add-to-cart=101&quantity=2&lang=en`),
    true,
  );
  assert.equal(
    isSafeCheckoutRedirectUrl(
      `${STAGING_ORIGIN}/checkout/?mc_cart=101:1,102:2&lang=zh`,
      STAGING_ORIGIN,
    ),
    true,
  );
  assert.equal(
    isSafeCheckoutRedirectUrl("https://evil.example/checkout/?add-to-cart=101", STAGING_ORIGIN),
    false,
  );
  assert.equal(isSafeCheckoutRedirectUrl(`${STAGING_ORIGIN}/wp-admin/`), false);
  assert.equal(isSafeCheckoutRedirectUrl("javascript:alert(1)"), false);
  assert.equal(isSafeCheckoutRedirectUrl("http://shop.marianascoffee.com/checkout/"), false);
});

test("parseCheckoutResponse validates checkoutUrl and maps 409/429/502 cleanly", () => {
  const ok = parseCheckoutResponse(200, {
    ok: true,
    locale: "zh",
    checkoutUrl: `${STAGING_ORIGIN}/checkout/?add-to-cart=101&quantity=1&lang=zh`,
    summary: {
      items: [],
      totalQuantity: 1,
      subtotalMinor: 2400,
      formattedSubtotal: "$24.00",
      currencyCode: "USD",
      currencyMinorUnit: 2,
    },
  });
  assert.equal(ok.ok, true);

  const tamperedRedirect = parseCheckoutResponse(200, {
    ok: true,
    locale: "en",
    checkoutUrl: "javascript:alert(1)",
    summary: { items: [], totalQuantity: 1, subtotalMinor: 2400, formattedSubtotal: "$24.00", currencyCode: "USD", currencyMinorUnit: 2 },
  });
  assert.deepEqual(tamperedRedirect, { ok: false, kind: "invalid" });

  const conflict = parseCheckoutResponse(409, {
    ok: false,
    error: "items_unavailable",
    unavailableProductIds: [103],
    exceededProductIds: [101],
  });
  assert.deepEqual(conflict, {
    ok: false,
    kind: "items_unavailable",
    unavailableProductIds: [103],
    exceededProductIds: [101],
  });

  assert.deepEqual(parseCheckoutResponse(429, {}), { ok: false, kind: "rate_limited" });
  assert.deepEqual(parseCheckoutResponse(502, {}), { ok: false, kind: "store_unavailable" });
});

test("applyCheckoutConflictToCart drops unavailable items and clamps exceeded quantities", () => {
  const catalog = parseWooProductsPayload(
    [
      {
        id: 101,
        name: "Mt. Tapochao Roast",
        prices: { price: "2400", currency_code: "USD", currency_minor_unit: 2 },
        is_purchasable: true,
        is_in_stock: true,
        add_to_cart: { maximum: 3 },
      },
      {
        id: 102,
        name: "Colombian Roast",
        prices: { price: "2600", currency_code: "USD", currency_minor_unit: 2 },
        is_purchasable: true,
        is_in_stock: true,
      },
    ],
    STAGING_ORIGIN,
  );
  assert.ok(catalog);

  const updated = applyCheckoutConflictToCart(
    [
      { productId: 101, quantity: 6 },
      { productId: 102, quantity: 2 },
      { productId: 103, quantity: 1 },
    ],
    [103],
    [101],
    catalog,
  );

  assert.deepEqual(updated, [
    { productId: 101, quantity: 3 },
    { productId: 102, quantity: 2 },
  ]);
});

test("shopTranslations defines non-empty copy for all four supported locales", () => {
  for (const locale of SUPPORTED_LOCALES) {
    const copy = shopTranslations[locale];
    assert.ok(copy.title.length > 0, `${locale}.title`);
    assert.ok(copy.addToCart.length > 0, `${locale}.addToCart`);
    assert.ok(copy.cart.checkout.length > 0, `${locale}.cart.checkout`);
    assert.ok(copy.cart.checkoutErrors.items_unavailable.length > 0, `${locale}.items_unavailable`);
  }
});
