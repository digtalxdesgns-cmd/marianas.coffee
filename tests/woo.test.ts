// Run with `node --test "tests/**/*.test.ts"` (Node's built-in test runner).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SHOP_ORIGIN,
  normalizeLocale,
  normalizeShopOrigin,
  resolveShopOrigin,
} from "../lib/woo/config.ts";
import {
  fetchWooProducts,
  formatMinorPrice,
  parseWooProduct,
  parseWooProductsPayload,
  sanitizePlainText,
} from "../lib/woo/products.ts";
import {
  addToCart,
  CART_SCHEMA_VERSION,
  CART_STORAGE_KEY,
  cartItemCount,
  clearCart,
  loadCart,
  MAX_ITEM_QUANTITY,
  reconcileCartWithCatalog,
  removeFromCart,
  sanitizeCartLines,
  saveCart,
  setCartQuantity,
  type CartStorage,
} from "../lib/woo/cart.ts";
import { buildWooCheckoutUrl, buildWooShopUrl } from "../lib/woo/checkout.ts";

const STAGING_ORIGIN = "https://regionaltest.shop.marianascoffee.com";

function memoryStorage(initial: Record<string, string> = {}): CartStorage {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

// --- Origin & locale config ---

test("normalizeShopOrigin enforces HTTPS, strips paths, and rejects unsafe URLs", () => {
  assert.equal(normalizeShopOrigin("https://regionaltest.shop.marianascoffee.com/checkout/?x=1"), STAGING_ORIGIN);
  assert.equal(normalizeShopOrigin("http://localhost:8080/shop"), "http://localhost:8080");
  assert.equal(normalizeShopOrigin("http://127.0.0.1:8080"), "http://127.0.0.1:8080");
  assert.equal(normalizeShopOrigin("http://shop.marianascoffee.com"), null);
  assert.equal(normalizeShopOrigin("https://user:pass@shop.marianascoffee.com"), null);
  assert.equal(normalizeShopOrigin("javascript:alert(1)"), null);
  assert.equal(normalizeShopOrigin(""), null);
});

test("resolveShopOrigin prefers WOOCOMMERCE_URL over NEXT_PUBLIC_SHOP_URL with safe fallback", () => {
  assert.equal(
    resolveShopOrigin({
      WOOCOMMERCE_URL: `${STAGING_ORIGIN}/`,
      NEXT_PUBLIC_SHOP_URL: "https://shop.marianascoffee.com",
    }),
    STAGING_ORIGIN,
  );
  assert.equal(resolveShopOrigin({ WOOCOMMERCE_URL: "http://insecure.example" }), DEFAULT_SHOP_ORIGIN);
});

test("normalizeLocale maps all four supported languages and defaults to en", () => {
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("zh-CN"), "zh");
  assert.equal(normalizeLocale("ko_KR"), "ko");
  assert.equal(normalizeLocale("JA"), "ja");
  assert.equal(normalizeLocale("fr"), "en");
  assert.equal(normalizeLocale(null), "en");
});

// --- Product parsing & reader ---

test("parseWooProduct normalizes valid priced WooCommerce Store API products", () => {
  const product = parseWooProduct(
    {
      id: 101,
      name: "Mt. Tapochao Roast &amp; Blend",
      slug: "mt-tapochao-roast",
      sku: "MC-TAP-12",
      short_description: "<p>Smooth &amp; balanced &#8217;island&#8217; roast.</p>",
      permalink: `${STAGING_ORIGIN}/product/mt-tapochao-roast/`,
      prices: { price: "2450", currency_code: "USD", currency_minor_unit: 2 },
      images: [{ src: `${STAGING_ORIGIN}/wp-content/uploads/tapochao.png`, alt: "Tapochao bag" }],
      is_purchasable: true,
      is_in_stock: true,
      add_to_cart: { maximum: 12 },
    },
    STAGING_ORIGIN,
  );

  assert.ok(product);
  assert.equal(product.id, 101);
  assert.equal(product.name, "Mt. Tapochao Roast & Blend");
  assert.equal(product.shortDescription, "Smooth & balanced ’island’ roast.");
  assert.equal(product.priceMinor, 2450);
  assert.equal(product.formattedPrice, "$24.50");
  assert.equal(product.availability, "in_stock");
  assert.equal(product.canPurchase, true);
  assert.equal(product.maxQuantity, 12);
  assert.equal(product.permalink, `${STAGING_ORIGIN}/product/mt-tapochao-roast/`);
  assert.deepEqual(product.image, {
    src: `${STAGING_ORIGIN}/wp-content/uploads/tapochao.png`,
    alt: "Tapochao bag",
  });
});

test("parseWooProduct safely handles missing prices, zero prices, and out-of-stock products", () => {
  const unpriced = parseWooProduct(
    {
      id: 102,
      name: "Unpriced Sample Roast",
      prices: { price: "", currency_code: "USD", currency_minor_unit: 2 },
      is_purchasable: true,
      is_in_stock: true,
    },
    STAGING_ORIGIN,
  );
  assert.ok(unpriced);
  assert.equal(unpriced.priceMinor, null);
  assert.equal(unpriced.formattedPrice, null);
  assert.equal(unpriced.availability, "unavailable");
  assert.equal(unpriced.canPurchase, false);

  const zeroPriced = parseWooProduct(
    {
      id: 103,
      name: "Zero Price Draft",
      prices: { price: "0", currency_code: "USD", currency_minor_unit: 2 },
      is_purchasable: true,
      is_in_stock: true,
    },
    STAGING_ORIGIN,
  );
  assert.ok(zeroPriced);
  assert.equal(zeroPriced.canPurchase, false);
  assert.equal(zeroPriced.availability, "unavailable");

  const outOfStock = parseWooProduct(
    {
      id: 104,
      name: "Sold Out Roast",
      prices: { price: "2600", currency_code: "USD", currency_minor_unit: 2 },
      is_purchasable: true,
      is_in_stock: false,
    },
    STAGING_ORIGIN,
  );
  assert.ok(outOfStock);
  assert.equal(outOfStock.priceMinor, 2600);
  assert.equal(outOfStock.availability, "out_of_stock");
  assert.equal(outOfStock.canPurchase, false);
});

test("parseWooProduct strips unsafe image URLs and off-origin permalinks", () => {
  const product = parseWooProduct(
    {
      id: 105,
      name: "Saipan Blend",
      permalink: "https://evil.example/phish",
      prices: { price: "2800", currency_code: "USD", currency_minor_unit: 2 },
      images: [
        { src: "javascript:alert(1)", alt: "bad" },
        { src: "data:image/svg+xml,<svg/>", alt: "bad2" },
        { src: "https://cdn.marianascoffee.com/saipan.png", alt: "Safe image" },
      ],
      is_purchasable: true,
      is_in_stock: true,
    },
    STAGING_ORIGIN,
  );
  assert.ok(product);
  assert.equal(product.permalink, null);
  assert.deepEqual(product.image, {
    src: "https://cdn.marianascoffee.com/saipan.png",
    alt: "Safe image",
  });
});

test("sanitizePlainText removes HTML tags and control characters while keeping CJK", () => {
  assert.equal(sanitizePlainText("<b>塞班岛烘焙</b>\u0000 <i>사이판</i> サイパン", 100), "塞班岛烘焙 사이판 サイパン");
});

test("formatMinorPrice returns null for non-positive prices", () => {
  assert.equal(formatMinorPrice(2400, "USD", 2, "en"), "$24.00");
  assert.equal(formatMinorPrice(0, "USD", 2, "en"), null);
  assert.equal(formatMinorPrice(null, "USD", 2, "en"), null);
});

test("fetchWooProducts calls Store API with optional Basic Auth and handles errors gracefully", async () => {
  let capturedUrl = "";
  let capturedAuth = "";

  const mockFetch: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    const headers = init?.headers as Record<string, string> | undefined;
    capturedAuth = headers?.Authorization ?? "";
    return new Response(
      JSON.stringify([
        {
          id: 11,
          name: "Synthetic Test Roast 1",
          prices: { price: "1500", currency_code: "USD", currency_minor_unit: 2 },
          is_purchasable: true,
          is_in_stock: true,
        },
        {
          id: 11, // duplicate should be deduplicated
          name: "Duplicate",
          prices: { price: "1500", currency_code: "USD", currency_minor_unit: 2 },
          is_purchasable: true,
          is_in_stock: true,
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const res = await fetchWooProducts({
    shopOrigin: STAGING_ORIGIN,
    perPage: 10,
    basicAuth: { username: "staging-user", password: "synthetic-password" },
    fetchImpl: mockFetch,
  });

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.products.length, 1);
    assert.equal(res.products[0].id, 11);
    assert.equal(res.products[0].priceMinor, 1500);
  }
  assert.equal(capturedUrl, `${STAGING_ORIGIN}/wp-json/wc/store/v1/products?per_page=10`);
  assert.equal(
    capturedAuth,
    `Basic ${Buffer.from("staging-user:synthetic-password", "utf8").toString("base64")}`,
  );

  // HTTP error handling
  const failRes = await fetchWooProducts({
    shopOrigin: STAGING_ORIGIN,
    fetchImpl: async () => new Response("Unauthorized", { status: 401 }),
  });
  assert.deepEqual(failRes, { ok: false, error: "http_error", status: 401 });

  // Invalid origin rejected before fetch
  const badOrigin = await fetchWooProducts({
    shopOrigin: "http://insecure.example",
    fetchImpl: async () => {
      throw new Error("should not call fetch");
    },
  });
  assert.deepEqual(badOrigin, { ok: false, error: "invalid_origin" });
});

test("parseWooProductsPayload rejects non-array payloads", () => {
  assert.equal(parseWooProductsPayload({ code: "rest_forbidden" }, STAGING_ORIGIN), null);
});

// --- Browser cart utilities ---

test("cart operations add, cap, update, remove, and count items cleanly", () => {
  let cart = addToCart([], 10, 2);
  cart = addToCart(cart, 10, 3);
  cart = addToCart(cart, 20, 1);
  assert.deepEqual(cart, [
    { productId: 10, quantity: 5 },
    { productId: 20, quantity: 1 },
  ]);
  assert.equal(cartItemCount(cart), 6);

  cart = setCartQuantity(cart, 10, 999);
  assert.equal(cart[0].quantity, MAX_ITEM_QUANTITY);

  cart = setCartQuantity(cart, 20, 0);
  assert.deepEqual(cart, [{ productId: 10, quantity: MAX_ITEM_QUANTITY }]);

  cart = removeFromCart(cart, 10);
  assert.deepEqual(cart, []);
});

test("cart persistence strips client-supplied prices and survives corrupted storage", () => {
  const storage = memoryStorage({
    [CART_STORAGE_KEY]: JSON.stringify({
      version: CART_SCHEMA_VERSION,
      items: [
        { productId: 101, quantity: 2, price: 1, priceMinor: 1, name: "Hacked $0.01" },
        { productId: -5, quantity: 1 },
        { productId: 101, quantity: 1 },
      ],
    }),
  });

  const loaded = loadCart(storage);
  assert.deepEqual(loaded, [{ productId: 101, quantity: 3 }]);
  assert.equal("price" in loaded[0], false);

  saveCart(loaded, storage);
  assert.deepEqual(loadCart(storage), [{ productId: 101, quantity: 3 }]);

  clearCart(storage);
  assert.deepEqual(loadCart(storage), []);

  const brokenStorage = memoryStorage({ [CART_STORAGE_KEY]: "{not-valid-json" });
  assert.deepEqual(loadCart(brokenStorage), []);
});

test("reconcileCartWithCatalog drops unavailable/unpriced items and computes totals from catalog prices only", () => {
  const catalog = parseWooProductsPayload(
    [
      {
        id: 1,
        name: "Mt. Tapochao Roast",
        prices: { price: "2400", currency_code: "USD", currency_minor_unit: 2 },
        is_purchasable: true,
        is_in_stock: true,
        add_to_cart: { maximum: 3 },
      },
      {
        id: 2,
        name: "Out Of Stock Roast",
        prices: { price: "2600", currency_code: "USD", currency_minor_unit: 2 },
        is_purchasable: true,
        is_in_stock: false,
      },
      {
        id: 3,
        name: "Unpriced Roast",
        prices: { price: "", currency_code: "USD", currency_minor_unit: 2 },
        is_purchasable: true,
        is_in_stock: true,
      },
    ],
    STAGING_ORIGIN,
  );
  assert.ok(catalog);

  const reconciled = reconcileCartWithCatalog(
    sanitizeCartLines([
      { productId: 1, quantity: 5 }, // exceeds product max (3)
      { productId: 2, quantity: 1 }, // out of stock -> dropped
      { productId: 3, quantity: 1 }, // unpriced -> dropped
      { productId: 999, quantity: 1 }, // missing -> dropped
    ]),
    catalog,
  );

  assert.equal(reconciled.items.length, 1);
  assert.equal(reconciled.items[0].product.id, 1);
  assert.equal(reconciled.items[0].quantity, 3);
  assert.equal(reconciled.items[0].lineTotalMinor, 7200);
  assert.equal(reconciled.subtotalMinor, 7200);
  assert.equal(reconciled.currencyCode, "USD");
  assert.deepEqual(reconciled.adjustedProductIds, [1]);
  assert.deepEqual(reconciled.droppedProductIds, [2, 3, 999]);
});

// --- Checkout handoff URL builder ---

test("buildWooCheckoutUrl produces native single-item and multi-item handoff URLs for all four locales", () => {
  assert.equal(
    buildWooCheckoutUrl({
      shopOrigin: STAGING_ORIGIN,
      items: [{ productId: 101, quantity: 2 }],
      locale: "ja",
    }),
    `${STAGING_ORIGIN}/checkout/?add-to-cart=101&quantity=2&lang=ja`,
  );

  assert.equal(
    buildWooCheckoutUrl({
      shopOrigin: STAGING_ORIGIN,
      items: [
        { productId: 101, quantity: 2 },
        { productId: 202, quantity: 1 },
      ],
      locale: "ko",
    }),
    `${STAGING_ORIGIN}/checkout/?mc_cart=101%3A2%2C202%3A1&lang=ko`,
  );

  assert.equal(
    buildWooCheckoutUrl({
      shopOrigin: STAGING_ORIGIN,
      items: [{ productId: 101, quantity: 1 }],
      locale: "zh",
    }),
    `${STAGING_ORIGIN}/checkout/?add-to-cart=101&quantity=1&lang=zh`,
  );

  assert.equal(buildWooCheckoutUrl({ shopOrigin: STAGING_ORIGIN, items: [] }), null);
  assert.equal(
    buildWooCheckoutUrl({
      shopOrigin: "javascript:alert(1)",
      items: [{ productId: 101, quantity: 1 }],
    }),
    null,
  );
});

test("buildWooShopUrl locks links to the validated shop origin and preserves language", () => {
  assert.equal(
    buildWooShopUrl({ shopOrigin: STAGING_ORIGIN, locale: "zh", path: "/cart/" }),
    `${STAGING_ORIGIN}/cart/?lang=zh`,
  );
  assert.equal(
    buildWooShopUrl({ shopOrigin: STAGING_ORIGIN, locale: "en", path: "//evil.example/steal" }),
    null,
  );
  assert.equal(
    buildWooShopUrl({ shopOrigin: STAGING_ORIGIN, locale: "en", path: "https://evil.example" }),
    null,
  );
});
