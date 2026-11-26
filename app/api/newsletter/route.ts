import { NextResponse } from "next/server";
import { getNewsletterDelivery } from "@/lib/forms/delivery";
import { clientKey, createRateLimiter, isSameOrigin, readJsonBody } from "@/lib/forms/guard";
import { parseNewsletter } from "@/lib/forms/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2 * 1024;
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

type ErrorCode = "invalid" | "rate_limited" | "unavailable" | "failed";

function fail(error: ErrorCode, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request.headers, request.url)) return fail("invalid", 403);
  if (!limiter.allow(clientKey(request.headers))) return fail("rate_limited", 429);

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return fail("invalid", body.status);

  const parsed = parseNewsletter(body.value);
  if (!parsed.ok) return fail("invalid", 400);

  const delivery = getNewsletterDelivery();
  if (!delivery) return fail("unavailable", 503);

  try {
    const status = await delivery.subscribe(parsed.data.email, { receivedAt: new Date().toISOString() });
    // Success is only reported once the provider has accepted the address.
    return NextResponse.json({ ok: true, status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("newsletter subscribe failed", { provider: delivery.name, error: error instanceof Error ? error.name : "unknown" });
    return fail("failed", 502);
  }
}
