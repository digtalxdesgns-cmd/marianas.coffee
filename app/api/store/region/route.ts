import { NextResponse } from "next/server";
import { clientKey, createRateLimiter, isSameOrigin, readJsonBody } from "@/lib/forms/guard";
import {
  normalizeStoreRegion,
  REGION_COOKIE_NAME,
  resolveRegionFromRequest,
} from "@/lib/woo/region";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024;
const REGION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const getLimiter = createRateLimiter({ limit: 120, windowMs: 60 * 1000 });
const postLimiter = createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private",
  Vary: "Cookie",
} as const;

export async function GET(request: Request) {
  if (!getLimiter.allow(clientKey(request.headers))) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: NO_STORE_HEADERS },
    );
  }

  const url = new URL(request.url);
  const resolved = resolveRegionFromRequest({
    headers: request.headers,
    queryRegion: url.searchParams.get("region"),
  });

  return NextResponse.json(
    {
      ok: true,
      region: resolved.region,
      source: resolved.source,
      manualOverride: resolved.manualOverride,
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers, request.url)) {
    return NextResponse.json(
      { ok: false, error: "invalid_origin" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  if (!postLimiter.allow(clientKey(request.headers))) {
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

  if (!body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
    return NextResponse.json(
      { ok: false, error: "invalid_region" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const record = body.value as Record<string, unknown>;
  const region = normalizeStoreRegion(record.region);
  if (!region) {
    return NextResponse.json(
      { ok: false, error: "invalid_region" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    new URL(request.url).protocol === "https:";

  const response = NextResponse.json(
    {
      ok: true,
      region,
      source: "manual" as const,
      manualOverride: true,
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );

  response.cookies.set(REGION_COOKIE_NAME, region, {
    path: "/",
    maxAge: REGION_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: isHttps,
  });

  return response;
}
