import { NextResponse } from "next/server";
import { getWholesaleDelivery } from "@/lib/forms/delivery";
import { clientKey, createRateLimiter, isSameOrigin, readJsonBody } from "@/lib/forms/guard";
import { parseWholesale } from "@/lib/forms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

type ErrorCode = "invalid" | "rate_limited" | "unavailable" | "failed";

function fail(error: ErrorCode, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers, request.url)) return fail("invalid", 403);
  if (!limiter.allow(clientKey(request.headers))) return fail("rate_limited", 429);

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return fail("invalid", body.status);

  const parsed = parseWholesale(body.value);
  if (!parsed.ok) {
    // Bots get the same generic answer as malformed input.
    return parsed.reason === "invalid" ? fail("invalid", 400, { fields: parsed.fields }) : fail("invalid", 400);
  }

  const delivery = getWholesaleDelivery();
  if (!delivery) return fail("unavailable", 503);

  try {
    await delivery.deliver(parsed.data, { receivedAt: new Date().toISOString() });
  } catch (error) {
    // Never log the submission itself: it contains personal data.
    console.error("wholesale delivery failed", { provider: delivery.name, error: error instanceof Error ? error.name : "unknown" });
    return fail("failed", 502);
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
