// Safe WooCommerce checkout handoff and shop URL builders.
// Enforces a validated shop origin (preventing open redirects), preserves
// selected language across all 4 supported locales, and never passes client
// prices to WooCommerce.

import { normalizeLocale, normalizeShopOrigin, type StoreLocale } from "./config.ts";
import { sanitizeCartLines, type CartLine } from "./cart.ts";

export type BuildCheckoutUrlOptions = {
  shopOrigin: string;
  items: readonly CartLine[];
  locale?: StoreLocale;
};

/**
 * Builds a WooCommerce classic checkout handoff URL for the sanitized cart.
 * - Single item: uses native WooCommerce `?add-to-cart=<id>&quantity=<qty>&lang=<locale>`.
 * - Multi-item: uses `?mc_cart=<id>:<qty>,<id>:<qty>&lang=<locale>` for the
 *   staging-verified WooCommerce cart handoff handler.
 * Returns null if the shop origin is invalid or the cart has no valid items.
 */
export function buildWooCheckoutUrl(options: BuildCheckoutUrlOptions): string | null {
  const origin = normalizeShopOrigin(options.shopOrigin);
  if (!origin) return null;

  const clean = sanitizeCartLines(options.items);
  if (clean.length === 0) return null;

  const locale = normalizeLocale(options.locale);
  const url = new URL("/checkout/", origin);

  if (clean.length === 1) {
    const [only] = clean;
    url.searchParams.set("add-to-cart", String(only.productId));
    url.searchParams.set("quantity", String(only.quantity));
  } else {
    const encoded = clean.map((line) => `${line.productId}:${line.quantity}`).join(",");
    url.searchParams.set("mc_cart", encoded);
  }

  url.searchParams.set("lang", locale);
  return url.toString();
}

/**
 * Builds a safe, origin-locked URL on the WooCommerce store (e.g. `/`, `/cart/`,
 * `/product/<slug>/`) with the active locale query parameter preserved.
 */
export function buildWooShopUrl(options: {
  shopOrigin: string;
  locale?: StoreLocale;
  path?: string;
}): string | null {
  const origin = normalizeShopOrigin(options.shopOrigin);
  if (!origin) return null;

  const rawPath = (options.path ?? "/").trim();
  if (rawPath.startsWith("//") || /^[a-z]+:/i.test(rawPath)) return null;
  const safePath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

  const url = new URL(safePath, origin);
  if (url.origin !== origin) return null;

  url.searchParams.set("lang", normalizeLocale(options.locale));
  return url.toString();
}
