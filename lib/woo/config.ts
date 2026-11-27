// Shared configuration and origin/locale validation for the headless
// WooCommerce storefront. Zero external imports so it runs natively under
// `node --test` as well as in Next.js server and client code.

export const SUPPORTED_LOCALES = ["en", "zh", "ko", "ja"] as const;
export type StoreLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_SHOP_ORIGIN = "https://shop.marianascoffee.com";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isStoreLocale(value: unknown): value is StoreLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown): StoreLocale {
  if (typeof value !== "string") return "en";
  const normalized = value.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return isStoreLocale(normalized) ? normalized : "en";
}

/**
 * Validates and normalizes a WooCommerce base origin.
 * Enforces HTTPS everywhere except local development hosts, rejects embedded
 * credentials, and strips any path, query, or hash so callers cannot inject
 * unexpected paths or open redirects.
 */
export function normalizeShopOrigin(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.username || parsed.password) return null;

  const isHttps = parsed.protocol === "https:";
  const isLocalHttp = parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname.toLowerCase());
  if (!isHttps && !isLocalHttp) return null;

  return parsed.origin;
}

/**
 * Resolves the active WooCommerce origin from environment variables, preferring
 * the server-only WOOCOMMERCE_URL over NEXT_PUBLIC_SHOP_URL.
 */
export function resolveShopOrigin(env?: Record<string, string | undefined>): string {
  const source = env ?? (typeof process !== "undefined" ? process.env : undefined);
  return (
    normalizeShopOrigin(source?.WOOCOMMERCE_URL) ??
    normalizeShopOrigin(source?.NEXT_PUBLIC_SHOP_URL) ??
    DEFAULT_SHOP_ORIGIN
  );
}
