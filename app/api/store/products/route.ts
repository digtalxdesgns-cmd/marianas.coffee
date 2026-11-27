import { NextResponse } from "next/server";
import { clientKey, createRateLimiter } from "@/lib/forms/guard";
import { normalizeLocale } from "@/lib/woo/config";
import { fetchWooProducts } from "@/lib/woo/products";
import { getWooServerConfig } from "@/lib/woo/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 60, windowMs: 60 * 1000 });

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private",
} as const;

export async function GET(request: Request) {
  if (!limiter.allow(clientKey(request.headers))) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: NO_STORE_HEADERS },
    );
  }

  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get("lang"));
  const rawPerPage = Number.parseInt(url.searchParams.get("perPage") ?? "", 10);
  const perPage = Number.isFinite(rawPerPage) ? rawPerPage : undefined;

  const config = getWooServerConfig();
  const result = await fetchWooProducts({
    shopOrigin: config.shopOrigin,
    perPage,
    timeoutMs: config.timeoutMs,
    locale,
    basicAuth: config.basicAuth,
  });

  if (!result.ok) {
    console.error("woo product fetch failed", {
      error: result.error,
      status: result.status,
    });
    return NextResponse.json(
      { ok: false, error: "store_unavailable" },
      {
        status: result.error === "invalid_origin" ? 503 : 502,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      locale,
      products: result.products,
    },
    {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Language": locale,
      },
    },
  );
}
