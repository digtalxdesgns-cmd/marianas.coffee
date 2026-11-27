// Reliable, privacy-respecting regional detection and persistence for Marianas Coffee.
// Supported commerce regions: Saipan (CNMI), Guam, Shanghai (China).
//
// Design invariants:
// 1. Manual region selection ALWAYS takes priority over automatic geolocation.
// 2. Region is strictly independent of UI language (en/zh/ko/ja).
// 3. Never assumes all US visitors are in Saipan or Guam; checks CNMI (MP) and Guam (GU) explicitly.
// 4. Uses only deployment-provided server headers (e.g. Vercel x-vercel-ip-country /
//    x-vercel-ip-country-region, or Cloudflare cf-ipcountry) — zero GPS, zero paid APIs,
//    never trusts browser Accept-Language or spoofable client IP headers.
// 5. Region selection never silently alters prices, currencies, shipping rules, or taxes.

export const SUPPORTED_REGIONS = ["saipan", "guam", "shanghai"] as const;
export type StoreRegion = (typeof SUPPORTED_REGIONS)[number];

export const DEFAULT_REGION: StoreRegion = "saipan";
export const REGION_COOKIE_NAME = "mc_region";
export const REGION_STORAGE_KEY = "marianas-coffee-region";

export type RegionSource = "manual" | "detected" | "default";

export type ResolvedRegion = {
  region: StoreRegion;
  source: RegionSource;
  manualOverride: boolean;
  /** Sanitized 2-letter ISO country code observed from trustworthy edge headers, or null. */
  detectedCountry: string | null;
};

export type RegionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// Special non-country codes used by CDNs/proxies for unknown, Tor, or anonymous proxies.
const UNTRUSTED_COUNTRY_CODES = new Set(["XX", "T1", "ZZ", "A1", "A2", "O1"]);

export function isStoreRegion(value: unknown): value is StoreRegion {
  return typeof value === "string" && (SUPPORTED_REGIONS as readonly string[]).includes(value);
}

export function normalizeStoreRegion(value: unknown): StoreRegion | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toLowerCase();
  return isStoreRegion(cleaned) ? cleaned : null;
}

function normalizeIsoCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{2}$/.test(cleaned)) return null;
  if (UNTRUSTED_COUNTRY_CODES.has(cleaned)) return null;
  return cleaned;
}

/**
 * Extracts the validated manual region cookie (`mc_region`) from a Cookie header.
 */
export function parseRegionCookie(cookieHeader: string | null | undefined): StoreRegion | null {
  if (typeof cookieHeader !== "string" || !cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) continue;
    const name = part.slice(0, eqIndex).trim();
    if (name !== REGION_COOKIE_NAME) continue;
    const rawValue = part.slice(eqIndex + 1).trim();
    try {
      return normalizeStoreRegion(decodeURIComponent(rawValue));
    } catch {
      return normalizeStoreRegion(rawValue);
    }
  }
  return null;
}

/**
 * Maps trustworthy deployment-provided geolocation headers to a supported commerce region.
 * Returns null when location is missing, ambiguous, VPN/Tor, mainland US, or another country.
 */
export function detectRegionFromGeoHeaders(headers: Headers): {
  region: StoreRegion | null;
  detectedCountry: string | null;
} {
  const vercelCountry = normalizeIsoCode(headers.get("x-vercel-ip-country"));
  const cfCountry = normalizeIsoCode(headers.get("cf-ipcountry"));

  // Prefer Vercel edge header; fall back to Cloudflare only when Vercel header is absent.
  const country = vercelCountry ?? cfCountry;
  if (!country) {
    return { region: null, detectedCountry: null };
  }

  // Explicit ISO 3166-1 alpha-2 territory codes.
  if (country === "MP") {
    return { region: "saipan", detectedCountry: "MP" };
  }
  if (country === "GU") {
    return { region: "guam", detectedCountry: "GU" };
  }
  if (country === "CN") {
    return { region: "shanghai", detectedCountry: "CN" };
  }

  // Defensive territory check if an upstream provider reports US + MP/GU subdivision.
  // Never assume mainland US (CA, NY, HI, etc.) belongs to Saipan or Guam.
  if (country === "US") {
    const subdivision = normalizeIsoCode(headers.get("x-vercel-ip-country-region"));
    if (subdivision === "MP") {
      return { region: "saipan", detectedCountry: "MP" };
    }
    if (subdivision === "GU") {
      return { region: "guam", detectedCountry: "GU" };
    }
    return { region: null, detectedCountry: "US" };
  }

  return { region: null, detectedCountry: country };
}

/**
 * Resolves the active shopping region using strict priority:
 * 1. Explicit manual override (validated query parameter or `mc_region` cookie).
 * 2. Trustworthy deployment geolocation headers (CNMI/MP, Guam/GU, China/CN).
 * 3. Documented safe default (`saipan`, source="default").
 */
export function resolveRegionFromRequest(options: {
  headers: Headers;
  queryRegion?: string | null;
}): ResolvedRegion {
  const { detectedCountry, region: geoRegion } = detectRegionFromGeoHeaders(options.headers);

  const manualQuery = normalizeStoreRegion(options.queryRegion);
  if (manualQuery) {
    return {
      region: manualQuery,
      source: "manual",
      manualOverride: true,
      detectedCountry,
    };
  }

  const manualCookie = parseRegionCookie(options.headers.get("cookie"));
  if (manualCookie) {
    return {
      region: manualCookie,
      source: "manual",
      manualOverride: true,
      detectedCountry,
    };
  }

  if (geoRegion) {
    return {
      region: geoRegion,
      source: "detected",
      manualOverride: false,
      detectedCountry,
    };
  }

  return {
    region: DEFAULT_REGION,
    source: "default",
    manualOverride: false,
    detectedCountry,
  };
}

export function loadManualRegion(storage: RegionStorage | null | undefined): StoreRegion | null {
  if (!storage) return null;
  try {
    return normalizeStoreRegion(storage.getItem(REGION_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveManualRegion(
  region: StoreRegion,
  storage: RegionStorage | null | undefined,
): boolean {
  if (!storage || !isStoreRegion(region)) return false;
  try {
    storage.setItem(REGION_STORAGE_KEY, region);
    return true;
  } catch {
    return false;
  }
}

export function clearManualRegion(storage: RegionStorage | null | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(REGION_STORAGE_KEY);
  } catch {
    // Ignore storage access restrictions.
  }
}
