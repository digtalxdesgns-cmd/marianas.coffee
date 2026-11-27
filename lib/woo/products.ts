// Secure, read-only WooCommerce Store API v1 product reader and normalizer.
// Never trusts raw prices or HTML, handles missing prices and out-of-stock
// items safely, and supports server-only HTTP Basic Auth for protected staging.

import { normalizeShopOrigin, type StoreLocale } from "./config.ts";

export type ProductAvailability = "in_stock" | "out_of_stock" | "unavailable";

export type StoreProductImage = {
  src: string;
  alt: string;
};

export type StoreProduct = {
  id: number;
  slug: string;
  name: string;
  sku: string;
  shortDescription: string;
  permalink: string | null;
  image: StoreProductImage | null;
  /** Positive integer price in minor currency units (e.g. cents), or null when missing/invalid. */
  priceMinor: number | null;
  currencyCode: string;
  currencyMinorUnit: number;
  /** Formatted price string (e.g. "$24.00"), or null when price is missing/invalid. */
  formattedPrice: string | null;
  availability: ProductAvailability;
  /** True only when in stock, purchasable in WooCommerce, and priced > 0. */
  canPurchase: boolean;
  maxQuantity: number;
};

export type FetchProductsError = "invalid_origin" | "http_error" | "invalid_payload" | "network_error";

export type FetchProductsResult =
  | { ok: true; products: StoreProduct[] }
  | { ok: false; error: FetchProductsError; status?: number };

export type BasicAuthCredentials = {
  username: string;
  password: string;
};

export type FetchWooProductsOptions = {
  shopOrigin: string;
  perPage?: number;
  timeoutMs?: number;
  locale?: StoreLocale;
  basicAuth?: BasicAuthCredentials | null;
  fetchImpl?: typeof fetch;
};

const DEFAULT_PER_PAGE = 24;
const MAX_PER_PAGE = 50;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_QUANTITY = 20;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_NAME_LENGTH = 200;

const LOCALE_TAGS: Record<StoreLocale, string> = {
  en: "en-US",
  zh: "zh-CN",
  ko: "ko-KR",
  ja: "ja-JP",
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower in NAMED_ENTITIES) return NAMED_ENTITIES[lower];
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return match;
  });
}

/** Strips HTML tags and control characters, decodes common entities, and clamps length. */
export function sanitizePlainText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const withoutTags = value.replace(/<[^>]*>/g, " ");
  const decoded = decodeHtmlEntities(withoutTags);
  const cleaned = decoded
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trimEnd() : cleaned;
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function parseMinorUnit(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 4) {
    return value;
  }
  return 2;
}

function parseCurrencyCode(value: unknown): string {
  if (typeof value === "string" && /^[A-Z]{3}$/.test(value.trim().toUpperCase())) {
    return value.trim().toUpperCase();
  }
  return "USD";
}

function parseSafeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password) return null;
  const isHttps = parsed.protocol === "https:";
  const isLocalHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "[::1]");
  return isHttps || isLocalHttp ? parsed.toString() : null;
}

function parseSafePermalink(value: unknown, shopOrigin: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.origin !== shopOrigin) return null;
  if (parsed.username || parsed.password) return null;
  return parsed.toString();
}

export function formatMinorPrice(
  priceMinor: number | null,
  currencyCode: string,
  currencyMinorUnit: number,
  locale: StoreLocale = "en",
): string | null {
  if (priceMinor === null || !Number.isSafeInteger(priceMinor) || priceMinor <= 0) return null;
  const divisor = 10 ** currencyMinorUnit;
  const majorAmount = priceMinor / divisor;

  try {
    return new Intl.NumberFormat(LOCALE_TAGS[locale], {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: currencyMinorUnit,
      maximumFractionDigits: currencyMinorUnit,
    }).format(majorAmount);
  } catch {
    return `${currencyCode} ${majorAmount.toFixed(currencyMinorUnit)}`;
  }
}

/**
 * Parses a single WooCommerce Store API product object into a safe StoreProduct.
 * Returns null only when required identity fields (positive integer id, name) are missing.
 * Missing/zero prices or out-of-stock states are preserved explicitly with canPurchase=false.
 */
export function parseWooProduct(raw: unknown, shopOrigin: string, locale: StoreLocale = "en"): StoreProduct | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;

  const id = parsePositiveInt(item.id);
  const name = sanitizePlainText(item.name, MAX_NAME_LENGTH);
  if (id === null || !name) return null;

  const rawSlug = typeof item.slug === "string" ? item.slug.trim() : "";
  const slug = /^[a-z0-9-]+$/i.test(rawSlug) ? rawSlug.toLowerCase() : `product-${id}`;
  const sku = sanitizePlainText(item.sku, 64);
  const shortDescription = sanitizePlainText(item.short_description, MAX_DESCRIPTION_LENGTH);
  const permalink = parseSafePermalink(item.permalink, shopOrigin);

  // Prices: require a strict positive integer in minor units.
  const prices =
    item.prices && typeof item.prices === "object" && !Array.isArray(item.prices)
      ? (item.prices as Record<string, unknown>)
      : null;

  const currencyCode = parseCurrencyCode(prices?.currency_code);
  const currencyMinorUnit = parseMinorUnit(prices?.currency_minor_unit);
  const priceMinor = parsePositiveInt(prices?.price);
  const formattedPrice = formatMinorPrice(priceMinor, currencyCode, currencyMinorUnit, locale);

  // Image: first valid image URL only.
  let image: StoreProductImage | null = null;
  if (Array.isArray(item.images)) {
    for (const candidate of item.images) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
      const img = candidate as Record<string, unknown>;
      const src = parseSafeImageUrl(img.src) ?? parseSafeImageUrl(img.thumbnail);
      if (src) {
        const alt = sanitizePlainText(img.alt, MAX_NAME_LENGTH) || name;
        image = { src, alt };
        break;
      }
    }
  }

  const isPurchasable = item.is_purchasable === true;
  const isInStock = item.is_in_stock === true;

  let availability: ProductAvailability;
  if (priceMinor === null || !isPurchasable) {
    availability = "unavailable";
  } else if (!isInStock) {
    availability = "out_of_stock";
  } else {
    availability = "in_stock";
  }

  const addToCart =
    item.add_to_cart && typeof item.add_to_cart === "object" && !Array.isArray(item.add_to_cart)
      ? (item.add_to_cart as Record<string, unknown>)
      : null;
  const reportedMax = parsePositiveInt(addToCart?.maximum);
  const maxQuantity = reportedMax ? Math.min(reportedMax, DEFAULT_MAX_QUANTITY) : DEFAULT_MAX_QUANTITY;

  return {
    id,
    slug,
    name,
    sku,
    shortDescription,
    permalink,
    image,
    priceMinor,
    currencyCode,
    currencyMinorUnit,
    formattedPrice,
    availability,
    canPurchase: availability === "in_stock",
    maxQuantity,
  };
}

export function parseWooProductsPayload(
  payload: unknown,
  shopOrigin: string,
  locale: StoreLocale = "en",
): StoreProduct[] | null {
  if (!Array.isArray(payload)) return null;
  const products: StoreProduct[] = [];
  const seenIds = new Set<number>();

  for (const entry of payload) {
    const product = parseWooProduct(entry, shopOrigin, locale);
    if (!product || seenIds.has(product.id)) continue;
    seenIds.add(product.id);
    products.push(product);
  }

  return products;
}

function encodeBasicAuth(credentials: BasicAuthCredentials): string | null {
  if (!credentials.username || !credentials.password) return null;
  const raw = `${credentials.username}:${credentials.password}`;
  if (typeof Buffer !== "undefined") {
    return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
  }
  if (typeof btoa === "function") {
    return `Basic ${btoa(raw)}`;
  }
  return null;
}

/**
 * Fetches public catalog products from WooCommerce Store API v1.
 * Never throws; returns a discriminated result so callers can degrade gracefully.
 */
export async function fetchWooProducts(options: FetchWooProductsOptions): Promise<FetchProductsResult> {
  const origin = normalizeShopOrigin(options.shopOrigin);
  if (!origin) return { ok: false, error: "invalid_origin" };

  const perPage = Math.max(1, Math.min(MAX_PER_PAGE, Math.floor(options.perPage ?? DEFAULT_PER_PAGE)));
  const timeoutMs = Math.max(500, Math.min(30_000, Math.floor(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)));
  const fetchFn = options.fetchImpl ?? fetch;

  const endpoint = new URL("/wp-json/wc/store/v1/products", origin);
  endpoint.searchParams.set("per_page", String(perPage));

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.basicAuth) {
    const authHeader = encodeBasicAuth(options.basicAuth);
    if (authHeader) headers.Authorization = authHeader;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(endpoint.toString(), {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, error: "http_error", status: response.status };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, error: "invalid_payload" };
    }

    const products = parseWooProductsPayload(payload, origin, options.locale ?? "en");
    if (!products) {
      return { ok: false, error: "invalid_payload" };
    }

    return { ok: true, products };
  } catch {
    return { ok: false, error: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
