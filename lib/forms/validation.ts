// Pure validation for public form submissions. No imports, so it can be unit
// tested with Node's built-in test runner (`npm test`).

export const BUSINESS_TYPES = ["cafe", "hotel", "retail", "office", "other"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const LIMITS = {
  businessMin: 2,
  businessMax: 120,
  emailMax: 254,
  messageMax: 2000,
  /** Submissions faster than this after the form rendered are treated as bots. */
  minFillMs: 2500,
  /** Ignore form timestamps older than this (stale tab or replay). */
  maxFillMs: 24 * 60 * 60 * 1000,
} as const;

export type WholesaleLead = {
  business: string;
  email: string;
  type: BusinessType;
  message: string;
};

export type FieldError = "required" | "too_short" | "too_long" | "invalid";

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "invalid"; fields: Record<string, FieldError> }
  | { ok: false; reason: "bot" };

// Pragmatic email check: one @, no spaces, a dot in the domain, sane length.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

// Remove ASCII control characters except tab and newline, normalise newlines
// and trim. Keeps all printable Unicode (Chinese, Korean, Japanese, accents).
export function cleanText(value: unknown, keepNewlines = false): string {
  if (typeof value !== "string") return "";
  const normalised = value.replace(/\r\n?/g, "\n");
  const stripped = normalised.replace(keepNewlines ? /[\u0000-\u0008\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, keepNewlines ? "" : " ");
  return stripped.trim();
}

export function isValidEmail(email: string): boolean {
  return email.length > 0 && email.length <= LIMITS.emailMax && EMAIL_RE.test(email);
}

/**
 * Bot signals: a hidden "website" field that people never see, and a form
 * render timestamp. Both are cheap checks, not a guarantee.
 */
export function looksLikeBot(input: Record<string, unknown>, now: number): boolean {
  const honeypot = typeof input.website === "string" ? input.website.trim() : "";
  if (honeypot.length > 0) return true;
  const startedAt = typeof input.startedAt === "number" ? input.startedAt : Number.NaN;
  if (!Number.isFinite(startedAt)) return true;
  const elapsed = now - startedAt;
  return elapsed < LIMITS.minFillMs || elapsed > LIMITS.maxFillMs;
}

export function parseWholesale(raw: unknown, now: number = Date.now()): ParseResult<WholesaleLead> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "invalid", fields: { form: "invalid" } };
  }
  const input = raw as Record<string, unknown>;
  if (looksLikeBot(input, now)) return { ok: false, reason: "bot" };

  const business = cleanText(input.business);
  const email = cleanText(input.email).toLowerCase();
  const type = cleanText(input.type);
  const message = cleanText(input.message, true);
  const fields: Record<string, FieldError> = {};

  if (!business) fields.business = "required";
  else if (business.length < LIMITS.businessMin) fields.business = "too_short";
  else if (business.length > LIMITS.businessMax) fields.business = "too_long";

  if (!email) fields.email = "required";
  else if (!isValidEmail(email)) fields.email = "invalid";

  if (!type) fields.type = "required";
  else if (!(BUSINESS_TYPES as readonly string[]).includes(type)) fields.type = "invalid";

  if (message.length > LIMITS.messageMax) fields.message = "too_long";

  if (Object.keys(fields).length > 0) return { ok: false, reason: "invalid", fields };
  return { ok: true, data: { business, email, type: type as BusinessType, message } };
}

export function parseNewsletter(raw: unknown, now: number = Date.now()): ParseResult<{ email: string }> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "invalid", fields: { form: "invalid" } };
  }
  const input = raw as Record<string, unknown>;
  if (looksLikeBot(input, now)) return { ok: false, reason: "bot" };
  const email = cleanText(input.email).toLowerCase();
  if (!email) return { ok: false, reason: "invalid", fields: { email: "required" } };
  if (!isValidEmail(email)) return { ok: false, reason: "invalid", fields: { email: "invalid" } };
  return { ok: true, data: { email } };
}
