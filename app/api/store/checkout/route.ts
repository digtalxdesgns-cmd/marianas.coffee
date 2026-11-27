import { NextResponse } from "next/server";
import { clientKey, createRateLimiter, isSameOrigin, readJsonBody } from "@/lib/forms/guard";
import { getWooServerConfig, validateCheckoutRequest } from "@/lib/woo/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const limiter = createRateLimiter({ limit: 20, windowMs: 60 * 1000 });

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private",
} as const;

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers, request.url)) {
    return NextResponse.json(
      { ok: false, error: "invalid_origin" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  if (!limiter.allow(clientKey(request.headers))) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: NO_STORE_HEADERS },
    );
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: body.status, headers: NO_STORE_HEADERS },
    );
  }

  const config = getWooServerConfig();
  const result = await validateCheckoutRequest(body.value, { config });

  if (!result.ok) {
    if (result.status >= 500) {
      console.error("woo checkout validation unavailable", { status: result.status });
    }
    return NextResponse.json(
      result.status === 409
        ? {
            ok: false,
            error: result.error,
            unavailableProductIds: result.unavailableProductIds,
            exceededProductIds: result.exceededProductIds,
          }
        : { ok: false, error: result.error },
      { status: result.status, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      locale: result.locale,
      checkoutUrl: result.checkoutUrl,
      summary: result.summary,
    },
    {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Language": result.locale,
      },
    },
  );
}
