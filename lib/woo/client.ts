// Pure client-side helpers for /shop API parsing, checkout payload construction,
// response validation (anti-open-redirect), and stock/price conflict recovery.
// Zero React/DOM imports so it runs directly under `node --test`.

import { normalizeLocale, normalizeShopOrigin, type StoreLocale } from "./config.ts";
import { sanitizeCartLines, MAX_ITEM_QUANTITY, type CartLine } from "./cart.ts";
import type { StoreProduct } from "./products.ts";
import type { ValidatedCheckoutSummary } from "./server.ts";

export type StoreProductsApiResult =
  | { ok: true; locale: StoreLocale; products: StoreProduct[] }
  | { ok: false; error: "rate_limited" | "store_unavailable" | "invalid_response" };

export type CheckoutErrorKind =
  | "items_unavailable"
  | "store_unavailable"
  | "rate_limited"
  | "invalid"
  | "network";

export type CheckoutApiResult =
  | {
      ok: true;
      locale: StoreLocale;
      checkoutUrl: string;
      summary: ValidatedCheckoutSummary;
    }
  | {
      ok: false;
      kind: "items_unavailable";
      unavailableProductIds: number[];
      exceededProductIds: number[];
    }
  | {
      ok: false;
      kind: Exclude<CheckoutErrorKind, "items_unavailable">;
    };

function isStoreProduct(value: unknown): value is StoreProduct {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "number" &&
    Number.isSafeInteger(record.id) &&
    record.id > 0 &&
    typeof record.name === "string" &&
    record.name.length > 0 &&
    typeof record.canPurchase === "boolean" &&
    typeof record.maxQuantity === "number"
  );
}

export function parseStoreProductsResponse(status: number, payload: unknown): StoreProductsApiResult {
  if (status === 429) return { ok: false, error: "rate_limited" };
  if (status >= 500) return { ok: false, error: "store_unavailable" };
  if (status !== 200 || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "invalid_response" };
  }

  const record = payload as Record<string, unknown>;
  if (record.ok !== true || !Array.isArray(record.products)) {
    return { ok: false, error: "invalid_response" };
  }

  const products = record.products.filter(isStoreProduct);
  return {
    ok: true,
    locale: normalizeLocale(record.locale),
    products,
  };
}

/**
 * Builds the minimal checkout validation payload.
 * Guarantees only product IDs, quantities, and normalized locale are sent —
 * never client-side prices, names, or totals.
 */
export function buildCheckoutPayload(
  items: readonly CartLine[],
  locale: StoreLocale,
): { items: CartLine[]; locale: StoreLocale } {
  return {
    items: sanitizeCartLines(items).map(({ productId, quantity }) => ({ productId, quantity })),
    locale: normalizeLocale(locale),
  };
}

/**
 * Validates that a returned checkout URL is a safe HTTPS (or local dev) URL
 * targeting the WooCommerce `/checkout/` path with no embedded credentials.
 */
export function isSafeCheckoutRedirectUrl(rawUrl: unknown, expectedOrigin?: string | null): rawUrl is string {
  if (typeof rawUrl !== "string") return false;
  const origin = normalizeShopOrigin(rawUrl);
  if (!origin) return false;

  if (expectedOrigin) {
    const normalizedExpected = normalizeShopOrigin(expectedOrigin);
    if (!normalizedExpected || origin !== normalizedExpected) return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  return parsed.pathname === "/checkout/" || parsed.pathname === "/checkout";
}

function parseIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0);
}

export function parseCheckoutResponse(
  status: number,
  payload: unknown,
  expectedOrigin?: string | null,
): CheckoutApiResult {
  if (status === 429) return { ok: false, kind: "rate_limited" };
  if (status >= 500) return { ok: false, kind: "store_unavailable" };

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, kind: "invalid" };
  }
  const record = payload as Record<string, unknown>;

  if (status === 409 && record.error === "items_unavailable") {
    return {
      ok: false,
      kind: "items_unavailable",
      unavailableProductIds: parseIdArray(record.unavailableProductIds),
      exceededProductIds: parseIdArray(record.exceededProductIds),
    };
  }

  if (
    status === 200 &&
    record.ok === true &&
    isSafeCheckoutRedirectUrl(record.checkoutUrl, expectedOrigin) &&
    record.summary &&
    typeof record.summary === "object"
  ) {
    return {
      ok: true,
      locale: normalizeLocale(record.locale),
      checkoutUrl: record.checkoutUrl,
      summary: record.summary as ValidatedCheckoutSummary,
    };
  }

  return { ok: false, kind: "invalid" };
}

/**
 * Updates cart lines after a 409 checkout conflict by removing unavailable
 * products and clamping over-limit products to current catalog max quantities.
 */
export function applyCheckoutConflictToCart(
  items: readonly CartLine[],
  unavailableProductIds: readonly number[],
  exceededProductIds: readonly number[],
  catalog: readonly StoreProduct[],
): CartLine[] {
  const unavailable = new Set(unavailableProductIds);
  const exceeded = new Set(exceededProductIds);
  const byId = new Map<number, StoreProduct>();
  for (const product of catalog) byId.set(product.id, product);

  const next: CartLine[] = [];
  for (const line of sanitizeCartLines(items)) {
    if (unavailable.has(line.productId)) continue;
    const product = byId.get(line.productId);
    if (exceeded.has(line.productId)) {
      if (!product || !product.canPurchase) continue;
      const cap = Math.max(1, Math.min(MAX_ITEM_QUANTITY, product.maxQuantity));
      next.push({ productId: line.productId, quantity: Math.min(line.quantity, cap) });
      continue;
    }
    next.push(line);
  }
  return next;
}
