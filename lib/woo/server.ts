// Server-side WooCommerce configuration and checkout validation helpers.
// Keeps staging credentials strictly on the server and guarantees all prices,
// availability, and checkout handoff URLs are derived from WooCommerce.

import {
  normalizeLocale,
  normalizeShopOrigin,
  resolveShopOrigin,
  type StoreLocale,
} from "./config.ts";
import {
  fetchWooProducts,
  formatMinorPrice,
  type BasicAuthCredentials,
  type StoreProduct,
} from "./products.ts";
import {
  MAX_CART_LINES,
  MAX_ITEM_QUANTITY,
  type CartLine,
} from "./cart.ts";
import { buildWooCheckoutUrl } from "./checkout.ts";

export type WooServerConfig = {
  shopOrigin: string;
  basicAuth: BasicAuthCredentials | null;
  timeoutMs: number;
};

const DEFAULT_TIMEOUT_MS = 8000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 15_000;

/**
 * Reads server-only WooCommerce connection settings from environment variables.
 * Never returns or serializes credentials to the browser.
 */
export function getWooServerConfig(env?: Record<string, string | undefined>): WooServerConfig {
  const source = env ?? (typeof process !== "undefined" ? process.env : undefined);
  const shopOrigin = resolveShopOrigin(source);

  const username = source?.WOOCOMMERCE_STAGING_USER?.trim() ?? "";
  const password = source?.WOOCOMMERCE_STAGING_PASS ?? "";
  const basicAuth = username && password ? { username, password } : null;

  const rawTimeout = Number.parseInt(source?.WOOCOMMERCE_FETCH_TIMEOUT_MS ?? "", 10);
  const timeoutMs = Number.isFinite(rawTimeout)
    ? Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, rawTimeout))
    : DEFAULT_TIMEOUT_MS;

  return { shopOrigin, basicAuth, timeoutMs };
}

export type CheckoutParseError =
  | "invalid_body"
  | "unexpected_fields"
  | "empty_cart"
  | "too_many_items"
  | "invalid_item"
  | "quantity_exceeded";

export type ParsedCheckoutInput = {
  items: CartLine[];
  locale: StoreLocale;
};

export type ParseCheckoutResult =
  | { ok: true; data: ParsedCheckoutInput }
  | { ok: false; error: CheckoutParseError };

const ALLOWED_TOP_KEYS = new Set(["items", "locale"]);
const ALLOWED_ITEM_KEYS = new Set(["productId", "quantity"]);

function isPositiveSafeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/**
 * Strictly parses a checkout validation request payload.
 * Accepts ONLY `{ items: [{ productId, quantity }], locale? }`.
 * Rejects any unexpected fields (including client-supplied prices or totals),
 * invalid IDs/quantities, empty carts, or excessive line counts/quantities.
 */
export function parseCheckoutBody(raw: unknown): ParseCheckoutResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid_body" };
  }

  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!ALLOWED_TOP_KEYS.has(key)) {
      return { ok: false, error: "unexpected_fields" };
    }
  }

  if (!Array.isArray(body.items)) {
    return { ok: false, error: "invalid_body" };
  }
  if (body.items.length === 0) {
    return { ok: false, error: "empty_cart" };
  }
  if (body.items.length > MAX_CART_LINES) {
    return { ok: false, error: "too_many_items" };
  }

  const merged = new Map<number, number>();
  for (const entry of body.items) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, error: "invalid_item" };
    }
    const record = entry as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!ALLOWED_ITEM_KEYS.has(key)) {
        return { ok: false, error: "unexpected_fields" };
      }
    }

    if (!isPositiveSafeInt(record.productId) || !isPositiveSafeInt(record.quantity)) {
      return { ok: false, error: "invalid_item" };
    }

    const nextQty = (merged.get(record.productId) ?? 0) + record.quantity;
    if (nextQty > MAX_ITEM_QUANTITY) {
      return { ok: false, error: "quantity_exceeded" };
    }
    if (!merged.has(record.productId) && merged.size >= MAX_CART_LINES) {
      return { ok: false, error: "too_many_items" };
    }
    merged.set(record.productId, nextQty);
  }

  const locale = normalizeLocale(body.locale);
  const items = Array.from(merged, ([productId, quantity]) => ({ productId, quantity }));
  return { ok: true, data: { items, locale } };
}

export type ValidatedCheckoutItem = {
  productId: number;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  formattedLineTotal: string | null;
};

export type ValidatedCheckoutSummary = {
  items: ValidatedCheckoutItem[];
  totalQuantity: number;
  subtotalMinor: number | null;
  formattedSubtotal: string | null;
  currencyCode: string | null;
  currencyMinorUnit: number;
};

export type CheckoutValidationResult =
  | {
      ok: true;
      locale: StoreLocale;
      checkoutUrl: string;
      summary: ValidatedCheckoutSummary;
    }
  | {
      ok: false;
      status: 400;
      error: CheckoutParseError;
    }
  | {
      ok: false;
      status: 409;
      error: "items_unavailable";
      unavailableProductIds: number[];
      exceededProductIds: number[];
    }
  | {
      ok: false;
      status: 502 | 503;
      error: "store_unavailable";
    };

export type ValidateCheckoutOptions = {
  config: WooServerConfig;
  fetchImpl?: typeof fetch;
};

/**
 * Validates requested product IDs and quantities against live WooCommerce
 * Store API data and returns an origin-locked checkout handoff URL plus a
 * server-computed summary. Never creates orders or processes payments.
 */
export async function validateCheckoutRequest(
  rawBody: unknown,
  options: ValidateCheckoutOptions,
): Promise<CheckoutValidationResult> {
  const parsed = parseCheckoutBody(rawBody);
  if (!parsed.ok) {
    return { ok: false, status: 400, error: parsed.error };
  }

  const origin = normalizeShopOrigin(options.config.shopOrigin);
  if (!origin) {
    return { ok: false, status: 503, error: "store_unavailable" };
  }

  const catalogResult = await fetchWooProducts({
    shopOrigin: origin,
    perPage: 50,
    timeoutMs: options.config.timeoutMs,
    locale: parsed.data.locale,
    basicAuth: options.config.basicAuth,
    fetchImpl: options.fetchImpl,
  });

  if (!catalogResult.ok) {
    return {
      ok: false,
      status: catalogResult.error === "invalid_origin" ? 503 : 502,
      error: "store_unavailable",
    };
  }

  const byId = new Map<number, StoreProduct>();
  for (const product of catalogResult.products) {
    byId.set(product.id, product);
  }

  const unavailableProductIds: number[] = [];
  const exceededProductIds: number[] = [];
  const validatedItems: ValidatedCheckoutItem[] = [];

  let totalQuantity = 0;
  let subtotalMinor = 0;
  let currencyCode: string | null = null;
  let currencyMinorUnit = 2;
  let mixedCurrency = false;

  for (const line of parsed.data.items) {
    const product = byId.get(line.productId);
    if (!product || !product.canPurchase || product.priceMinor === null) {
      unavailableProductIds.push(line.productId);
      continue;
    }

    const cap = Math.max(1, Math.min(MAX_ITEM_QUANTITY, product.maxQuantity));
    if (line.quantity > cap) {
      exceededProductIds.push(line.productId);
      continue;
    }

    const lineTotalMinor = product.priceMinor * line.quantity;
    validatedItems.push({
      productId: product.id,
      name: product.name,
      quantity: line.quantity,
      unitPriceMinor: product.priceMinor,
      lineTotalMinor,
      formattedLineTotal: formatMinorPrice(
        lineTotalMinor,
        product.currencyCode,
        product.currencyMinorUnit,
        parsed.data.locale,
      ),
    });

    totalQuantity += line.quantity;
    if (currencyCode === null) {
      currencyCode = product.currencyCode;
      currencyMinorUnit = product.currencyMinorUnit;
    } else if (currencyCode !== product.currencyCode || currencyMinorUnit !== product.currencyMinorUnit) {
      mixedCurrency = true;
    }
    subtotalMinor += lineTotalMinor;
  }

  if (unavailableProductIds.length > 0 || exceededProductIds.length > 0) {
    return {
      ok: false,
      status: 409,
      error: "items_unavailable",
      unavailableProductIds,
      exceededProductIds,
    };
  }

  const checkoutUrl = buildWooCheckoutUrl({
    shopOrigin: origin,
    items: parsed.data.items,
    locale: parsed.data.locale,
  });
  if (!checkoutUrl) {
    return { ok: false, status: 503, error: "store_unavailable" };
  }

  const finalSubtotal = !mixedCurrency ? subtotalMinor : null;
  const finalCurrency = !mixedCurrency ? currencyCode : null;

  return {
    ok: true,
    locale: parsed.data.locale,
    checkoutUrl,
    summary: {
      items: validatedItems,
      totalQuantity,
      subtotalMinor: finalSubtotal,
      formattedSubtotal:
        finalSubtotal !== null && finalCurrency !== null
          ? formatMinorPrice(finalSubtotal, finalCurrency, currencyMinorUnit, parsed.data.locale)
          : null,
      currencyCode: finalCurrency,
      currencyMinorUnit,
    },
  };
}
