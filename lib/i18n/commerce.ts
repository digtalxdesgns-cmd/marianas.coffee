// Typed loader and validation helpers for the version-controlled 4-language
// Marianas Coffee storefront and WooCommerce checkout dictionary.

import rawDictionary from "./commerce-translations.json" with { type: "json" };
import { normalizeLocale, SUPPORTED_LOCALES, type StoreLocale } from "../woo/config.ts";

export type StorefrontRegionCopy = {
  label: string;
  selectLabel: string;
  saipan: string;
  guam: string;
  shanghai: string;
  sourceDetected: string;
  sourceManual: string;
  sourceDefault: string;
  independenceNote: string;
  pricingNote: string;
};

export type StorefrontCartCopy = {
  eyebrow: string;
  title: string;
  close: string;
  emptyTitle: string;
  emptyBody: string;
  continueShopping: string;
  subtotal: string;
  subtotalNote: string;
  decreaseQty: string;
  increaseQty: string;
  removeLabel: string;
  removeItem: string;
  maxLimitNote: string;
  checkout: string;
  validating: string;
  reconciledRemoved: string;
  reconciledAdjusted: string;
  checkoutErrors: {
    items_unavailable: string;
    store_unavailable: string;
    rate_limited: string;
    invalid: string;
    network: string;
  };
};

export type StorefrontCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  openCartLabel: string;
  catalogRegionLabel: string;
  loading: string;
  emptyTitle: string;
  emptyBody: string;
  backHome: string;
  errorTitle: string;
  errorBody: string;
  retry: string;
  inStock: string;
  outOfStock: string;
  unavailable: string;
  priceUnavailable: string;
  addToCart: string;
  addedToCart: string;
  inCart: string;
  maxReached: string;
  viewCart: string;
  productImageFallback: string;
  region: StorefrontRegionCopy;
  cart: StorefrontCartCopy;
};

export type WooTranslationEntry = {
  key: string;
  source: string;
  zh: string;
  ko: string;
  ja: string;
};

export type CommerceDictionary = {
  version: string;
  status: string;
  locales: readonly StoreLocale[];
  storefront: Record<StoreLocale, StorefrontCopy>;
  woocommerce: {
    categories: Record<string, WooTranslationEntry[]>;
  };
};

export const commerceDictionary = rawDictionary as unknown as CommerceDictionary;

export function getStorefrontCopy(locale: unknown): StorefrontCopy {
  const normalized = normalizeLocale(locale);
  return commerceDictionary.storefront[normalized] ?? commerceDictionary.storefront.en;
}

/**
 * Extracts printf-style placeholders (%s, %d, %1$s) in order so we can verify
 * that translated strings never break dynamic WooCommerce sprintf() calls.
 */
export function extractPrintfPlaceholders(text: string): string[] {
  return text.match(/%(?:\d+\$)?[sd]/g) ?? [];
}

/**
 * Extracts {token} placeholders used in storefront templates.
 */
export function extractTemplatePlaceholders(text: string): string[] {
  return (text.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort();
}

/**
 * Looks up a WooCommerce string by English source text with automatic fallback
 * to the original English source when missing or when locale is "en".
 */
export function translateWooString(source: string, locale: unknown): string {
  const normalized = normalizeLocale(locale);
  if (normalized === "en") return source;

  for (const entries of Object.values(commerceDictionary.woocommerce.categories)) {
    for (const entry of entries) {
      if (entry.source === source) {
        const translated = entry[normalized];
        return typeof translated === "string" && translated.trim().length > 0 ? translated : source;
      }
    }
  }
  return source;
}

export function listAllWooEntries(): WooTranslationEntry[] {
  return Object.values(commerceDictionary.woocommerce.categories).flat();
}

export function getSupportedLocales(): readonly StoreLocale[] {
  return SUPPORTED_LOCALES;
}
