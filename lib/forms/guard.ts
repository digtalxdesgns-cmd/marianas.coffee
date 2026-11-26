// Request guards shared by the public form endpoints. No imports, so it can be
// unit tested with Node's built-in test runner.

export type RateLimiter = {
  /** Returns true when the request is allowed, false when the key is over its limit. */
  allow: (key: string, now?: number) => boolean;
};

/**
 * Fixed-window, in-memory rate limiter. On Vercel each function instance keeps
 * its own memory, so this is a best-effort brake against bursts from one
 * client, not a global quota. A shared store (or a Vercel WAF rule) is the
 * durable option once one is approved.
 */
export function createRateLimiter(options: { limit: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const { limit, windowMs, maxKeys = 5000 } = options;
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    allow(key, now = Date.now()) {
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        if (hits.size >= maxKeys) {
          for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
          if (hits.size >= maxKeys) {
            const oldest = hits.keys().next().value;
            if (oldest !== undefined) hits.delete(oldest);
          }
        }
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= limit;
    },
  };
}

/** First address in x-forwarded-for (set by Vercel), else a shared bucket. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || "unknown";
}

/**
 * Browsers send Origin on POST. Reject cross-site posts; allow requests with no
 * Origin (curl, server-to-server) to be judged by the other checks.
 * The host the browser used comes from x-forwarded-host (set by Vercel) or Host;
 * the framework's internal request URL is only a fallback, as it may differ.
 */
export function isSameOrigin(headers: Headers, requestUrl: string): boolean {
  const origin = headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = (forwarded || headers.get("host") || new URL(requestUrl).host).toLowerCase();
    return originHost === host;
  } catch {
    return false;
  }
}

export type BodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 | 415 };

/** Reads a JSON body with a hard size cap. Never throws. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<BodyResult> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return { ok: false, status: 415 };
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 };
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400 };
  }
  if (new TextEncoder().encode(text).length > maxBytes) return { ok: false, status: 413 };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400 };
  }
}
