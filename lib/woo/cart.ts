// Browser cart utilities for the headless WooCommerce storefront.
// Security invariant: cart storage holds ONLY product IDs and quantities —
// never prices, totals, or product titles. Display prices and totals must
// always be reconciled against server-verified WooCommerce catalog data.

import type { StoreProduct } from "./products.ts";

export const CART_STORAGE_KEY = "marianas-coffee-cart-v1";
export const CART_SCHEMA_VERSION = 1;
export const MAX_CART_LINES = 20;
export const MAX_ITEM_QUANTITY = 20;

export type CartLine = {
  productId: number;
  quantity: number;
};

export type CartStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type PricedCartLine = {
  product: StoreProduct;
  quantity: number;
  lineTotalMinor: number;
};

export type ReconciledCart = {
  items: PricedCartLine[];
  droppedProductIds: number[];
  adjustedProductIds: number[];
  totalQuantity: number;
  /** Subtotal in minor units computed strictly from catalog prices, or null if empty/mixed currency. */
  subtotalMinor: number | null;
  currencyCode: string | null;
  currencyMinorUnit: number;
};

function isPositiveSafeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/**
 * Sanitizes untrusted cart line input (e.g. from localStorage or request payloads):
 * keeps only { productId, quantity }, merges duplicates, drops invalid lines,
 * and enforces quantity and line-count caps.
 */
export function sanitizeCartLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];

  const merged = new Map<number, number>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    if (!isPositiveSafeInt(record.productId) || !isPositiveSafeInt(record.quantity)) continue;

    if (!merged.has(record.productId) && merged.size >= MAX_CART_LINES) continue;
    const nextQty = Math.min(MAX_ITEM_QUANTITY, (merged.get(record.productId) ?? 0) + record.quantity);
    merged.set(record.productId, nextQty);
  }

  return Array.from(merged, ([productId, quantity]) => ({ productId, quantity }));
}

export function loadCart(storage: CartStorage | null | undefined): CartLine[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    const record = parsed as Record<string, unknown>;
    if (record.version !== CART_SCHEMA_VERSION) return [];
    return sanitizeCartLines(record.items);
  } catch {
    return [];
  }
}

export function saveCart(items: readonly CartLine[], storage: CartStorage | null | undefined): boolean {
  if (!storage) return false;
  try {
    const clean = sanitizeCartLines(items);
    storage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        version: CART_SCHEMA_VERSION,
        items: clean,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearCart(storage: CartStorage | null | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Ignore storage access errors (e.g. private browsing restrictions).
  }
}

export function addToCart(
  items: readonly CartLine[],
  productId: number,
  quantity = 1,
  maxQuantity = MAX_ITEM_QUANTITY,
): CartLine[] {
  if (!isPositiveSafeInt(productId) || !isPositiveSafeInt(quantity)) {
    return sanitizeCartLines(items);
  }

  const cap = Math.max(1, Math.min(MAX_ITEM_QUANTITY, Math.floor(maxQuantity)));
  const clean = sanitizeCartLines(items);
  const existingIndex = clean.findIndex((line) => line.productId === productId);

  if (existingIndex >= 0) {
    const updated = [...clean];
    updated[existingIndex] = {
      productId,
      quantity: Math.min(cap, updated[existingIndex].quantity + quantity),
    };
    return updated;
  }

  if (clean.length >= MAX_CART_LINES) return clean;
  return [...clean, { productId, quantity: Math.min(cap, quantity) }];
}

export function setCartQuantity(
  items: readonly CartLine[],
  productId: number,
  quantity: number,
  maxQuantity = MAX_ITEM_QUANTITY,
): CartLine[] {
  const clean = sanitizeCartLines(items);
  if (!isPositiveSafeInt(productId)) return clean;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return clean.filter((line) => line.productId !== productId);
  }

  const cap = Math.max(1, Math.min(MAX_ITEM_QUANTITY, Math.floor(maxQuantity)));
  const clamped = Math.min(cap, Math.floor(quantity));
  const exists = clean.some((line) => line.productId === productId);

  if (!exists) {
    if (clean.length >= MAX_CART_LINES) return clean;
    return [...clean, { productId, quantity: clamped }];
  }

  return clean.map((line) => (line.productId === productId ? { productId, quantity: clamped } : line));
}

export function removeFromCart(items: readonly CartLine[], productId: number): CartLine[] {
  return sanitizeCartLines(items).filter((line) => line.productId !== productId);
}

export function cartItemCount(items: readonly CartLine[]): number {
  return sanitizeCartLines(items).reduce((total, line) => total + line.quantity, 0);
}

/**
 * Reconciles browser cart IDs/quantities against the verified WooCommerce
 * product catalog. Drops unknown, out-of-stock, or unpriced products, clamps
 * quantities to product limits, and computes subtotals exclusively from
 * verified catalog prices.
 */
export function reconcileCartWithCatalog(
  items: readonly CartLine[],
  catalog: readonly StoreProduct[],
): ReconciledCart {
  const byId = new Map<number, StoreProduct>();
  for (const product of catalog) {
    byId.set(product.id, product);
  }

  const clean = sanitizeCartLines(items);
  const pricedItems: PricedCartLine[] = [];
  const droppedProductIds: number[] = [];
  const adjustedProductIds: number[] = [];

  let totalQuantity = 0;
  let subtotal = 0;
  let currencyCode: string | null = null;
  let currencyMinorUnit = 2;
  let mixedCurrency = false;

  for (const line of clean) {
    const product = byId.get(line.productId);
    if (!product || !product.canPurchase || product.priceMinor === null) {
      droppedProductIds.push(line.productId);
      continue;
    }

    const cap = Math.max(1, Math.min(MAX_ITEM_QUANTITY, product.maxQuantity));
    const quantity = Math.min(line.quantity, cap);
    if (quantity !== line.quantity) {
      adjustedProductIds.push(line.productId);
    }

    const lineTotalMinor = product.priceMinor * quantity;
    pricedItems.push({ product, quantity, lineTotalMinor });
    totalQuantity += quantity;

    if (currencyCode === null) {
      currencyCode = product.currencyCode;
      currencyMinorUnit = product.currencyMinorUnit;
    } else if (currencyCode !== product.currencyCode || currencyMinorUnit !== product.currencyMinorUnit) {
      mixedCurrency = true;
    }

    subtotal += lineTotalMinor;
  }

  return {
    items: pricedItems,
    droppedProductIds,
    adjustedProductIds,
    totalQuantity,
    subtotalMinor: pricedItems.length > 0 && !mixedCurrency ? subtotal : null,
    currencyCode: mixedCurrency ? null : currencyCode,
    currencyMinorUnit,
  };
}
