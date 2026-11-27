// Run with `node --test "tests/**/*.test.ts"` (Node's built-in test runner).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearManualRegion,
  DEFAULT_REGION,
  detectRegionFromGeoHeaders,
  loadManualRegion,
  parseRegionCookie,
  REGION_COOKIE_NAME,
  resolveRegionFromRequest,
  saveManualRegion,
  type RegionStorage,
} from "../lib/woo/region.ts";
import { normalizeLocale } from "../lib/woo/config.ts";

function memoryStorage(): RegionStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

test("detects CNMI (MP), Guam (GU), and mainland China (CN) from trustworthy Vercel headers", () => {
  assert.deepEqual(
    resolveRegionFromRequest({ headers: new Headers({ "x-vercel-ip-country": "MP" }) }),
    { region: "saipan", source: "detected", manualOverride: false, detectedCountry: "MP" },
  );

  assert.deepEqual(
    resolveRegionFromRequest({ headers: new Headers({ "x-vercel-ip-country": "GU" }) }),
    { region: "guam", source: "detected", manualOverride: false, detectedCountry: "GU" },
  );

  assert.deepEqual(
    resolveRegionFromRequest({ headers: new Headers({ "x-vercel-ip-country": "CN" }) }),
    { region: "shanghai", source: "detected", manualOverride: false, detectedCountry: "CN" },
  );
});

test("supports US+MP / US+GU territory subdivisions without assuming mainland US is Saipan or Guam", () => {
  assert.deepEqual(
    resolveRegionFromRequest({
      headers: new Headers({ "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "MP" }),
    }),
    { region: "saipan", source: "detected", manualOverride: false, detectedCountry: "MP" },
  );

  assert.deepEqual(
    resolveRegionFromRequest({
      headers: new Headers({ "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "GU" }),
    }),
    { region: "guam", source: "detected", manualOverride: false, detectedCountry: "GU" },
  );

  // Mainland US visitors must NOT be falsely reported as auto-detected Saipan/Guam.
  assert.deepEqual(
    resolveRegionFromRequest({
      headers: new Headers({ "x-vercel-ip-country": "US", "x-vercel-ip-country-region": "CA" }),
    }),
    { region: DEFAULT_REGION, source: "default", manualOverride: false, detectedCountry: "US" },
  );

  assert.deepEqual(
    resolveRegionFromRequest({
      headers: new Headers({ "x-vercel-ip-country": "US" }),
    }),
    { region: DEFAULT_REGION, source: "default", manualOverride: false, detectedCountry: "US" },
  );
});

test("falls back safely for other countries, missing headers, and VPN/Tor/spoofable headers", () => {
  for (const country of ["JP", "KR", "AU", "GB"]) {
    const res = resolveRegionFromRequest({ headers: new Headers({ "x-vercel-ip-country": country }) });
    assert.equal(res.region, DEFAULT_REGION);
    assert.equal(res.source, "default");
    assert.equal(res.manualOverride, false);
    assert.equal(res.detectedCountry, country);
  }

  // Missing headers
  assert.deepEqual(resolveRegionFromRequest({ headers: new Headers() }), {
    region: DEFAULT_REGION,
    source: "default",
    manualOverride: false,
    detectedCountry: null,
  });

  // VPN/Tor/unknown CDN codes & spoofable Accept-Language / X-Forwarded-For headers must be ignored
  for (const untrusted of ["XX", "T1", "ZZ", "invalid-country"]) {
    const res = resolveRegionFromRequest({
      headers: new Headers({
        "x-vercel-ip-country": untrusted,
        "accept-language": "zh-CN,zh;q=0.9",
        "x-forwarded-for": "1.2.3.4",
      }),
    });
    assert.deepEqual(res, {
      region: DEFAULT_REGION,
      source: "default",
      manualOverride: false,
      detectedCountry: null,
    });
  }

  // Cloudflare fallback works when Vercel header is absent
  assert.deepEqual(detectRegionFromGeoHeaders(new Headers({ "cf-ipcountry": "GU" })), {
    region: "guam",
    detectedCountry: "GU",
  });
});

test("manual region selection (cookie or query) always takes priority over geolocation headers", () => {
  const cookieOverride = resolveRegionFromRequest({
    headers: new Headers({
      "x-vercel-ip-country": "CN",
      cookie: `other=1; ${REGION_COOKIE_NAME}=guam; mc_checkout_lang=ja`,
    }),
  });
  assert.deepEqual(cookieOverride, {
    region: "guam",
    source: "manual",
    manualOverride: true,
    detectedCountry: "CN",
  });

  const queryOverride = resolveRegionFromRequest({
    headers: new Headers({
      "x-vercel-ip-country": "MP",
      cookie: `${REGION_COOKIE_NAME}=guam`,
    }),
    queryRegion: "shanghai",
  });
  assert.deepEqual(queryOverride, {
    region: "shanghai",
    source: "manual",
    manualOverride: true,
    detectedCountry: "MP",
  });

  // Invalid cookie value falls back to geo detection cleanly
  assert.equal(parseRegionCookie(`${REGION_COOKIE_NAME}=invalid-place`), null);
  const invalidCookie = resolveRegionFromRequest({
    headers: new Headers({
      "x-vercel-ip-country": "GU",
      cookie: `${REGION_COOKIE_NAME}=mars`,
    }),
  });
  assert.equal(invalidCookie.region, "guam");
  assert.equal(invalidCookie.source, "detected");
});

test("manual region persists cleanly in browser storage and stays independent of language", () => {
  const storage = memoryStorage();
  assert.equal(loadManualRegion(storage), null);
  assert.equal(saveManualRegion("guam", storage), true);
  assert.equal(loadManualRegion(storage), "guam");

  // Switching language does not alter stored region and vice versa
  assert.equal(normalizeLocale("ja"), "ja");
  assert.equal(loadManualRegion(storage), "guam");

  clearManualRegion(storage);
  assert.equal(loadManualRegion(storage), null);
});
