// Run with `npm test` (Node's built-in test runner; no extra dependencies).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, isValidEmail, parseNewsletter, parseWholesale, LIMITS } from "../lib/forms/validation.ts";
import { clientKey, createRateLimiter, isSameOrigin, readJsonBody } from "../lib/forms/guard.ts";

const NOW = 1_800_000_000_000;
const human = { startedAt: NOW - 10_000, website: "" };
const validLead = { business: "Test Café (synthetic)", email: "Buyer@Example.INVALID", type: "hotel", message: "About 20 kg a month\r\nfor two outlets.", ...human };

test("accepts a valid wholesale lead and normalises it", () => {
  const r = parseWholesale(validLead, NOW);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.email, "buyer@example.invalid");
    assert.equal(r.data.type, "hotel");
    assert.equal(r.data.message, "About 20 kg a month\nfor two outlets.");
  }
});

test("reports each missing or invalid field", () => {
  const r = parseWholesale({ ...human, business: "", email: "not-an-email", type: "casino" }, NOW);
  assert.equal(r.ok, false);
  if (!r.ok && r.reason === "invalid") {
    assert.deepEqual(r.fields, { business: "required", email: "invalid", type: "invalid" });
  } else assert.fail("expected invalid");
});

test("enforces length limits", () => {
  const r = parseWholesale({ ...validLead, business: "x".repeat(LIMITS.businessMax + 1), message: "y".repeat(LIMITS.messageMax + 1) }, NOW);
  assert.equal(r.ok, false);
  if (!r.ok && r.reason === "invalid") {
    assert.equal(r.fields.business, "too_long");
    assert.equal(r.fields.message, "too_long");
  }
});

test("accepts Chinese, Korean and Japanese business names", () => {
  for (const business of ["塞班咖啡馆", "사이판 카페", "サイパン喫茶"]) {
    assert.equal(parseWholesale({ ...validLead, business }, NOW).ok, true, business);
  }
});

test("rejects non-object bodies", () => {
  for (const body of [null, "text", 42, ["a"]]) assert.equal(parseWholesale(body, NOW).ok, false);
});

test("flags bots: honeypot filled, missing timestamp, too fast, too old", () => {
  const cases = [
    { ...validLead, website: "http://spam.example" },
    { ...validLead, startedAt: undefined },
    { ...validLead, startedAt: NOW - 500 },
    { ...validLead, startedAt: NOW - LIMITS.maxFillMs - 1 },
  ];
  for (const c of cases) {
    const r = parseWholesale(c, NOW);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "bot");
  }
});

test("cleanText strips control characters but keeps newlines only when asked", () => {
  assert.equal(cleanText("a\u0000b\u0007c"), "a b c");
  assert.equal(cleanText(" line1\nline2 ", true), "line1\nline2");
  assert.equal(cleanText(42), "");
});

test("email validation", () => {
  assert.equal(isValidEmail("a@b.co"), true);
  for (const bad of ["", "a@b", "a b@c.com", "@b.com", "a@.com", `${"a".repeat(250)}@b.com`]) assert.equal(isValidEmail(bad), false, bad);
});

test("newsletter parsing", () => {
  assert.equal(parseNewsletter({ ...human, email: "Reader@Example.INVALID" }, NOW).ok, true);
  const bad = parseNewsletter({ ...human, email: "nope" }, NOW);
  assert.equal(bad.ok, false);
  const bot = parseNewsletter({ ...human, email: "a@b.co", website: "x" }, NOW);
  assert.equal(!bot.ok && bot.reason, "bot");
});

test("rate limiter allows the limit, blocks the next, resets after the window", () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(limiter.allow("ip", 0), true);
  assert.equal(limiter.allow("ip", 10), true);
  assert.equal(limiter.allow("ip", 20), false);
  assert.equal(limiter.allow("other", 20), true);
  assert.equal(limiter.allow("ip", 1001), true);
});

test("rate limiter memory stays bounded", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 3 });
  for (const k of ["a", "b", "c", "d", "e"]) assert.equal(limiter.allow(k, 0), true);
});

test("same-origin check", () => {
  const url = "https://marianascoffee.com/api/wholesale";
  assert.equal(isSameOrigin(new Headers({ origin: "https://marianascoffee.com" }), url), true);
  assert.equal(isSameOrigin(new Headers({ origin: "https://evil.example" }), url), false);
  assert.equal(isSameOrigin(new Headers({ origin: "not a url" }), url), false);
  assert.equal(isSameOrigin(new Headers(), url), true);
  // The Host / x-forwarded-host the browser used wins over the internal URL.
  const internal = "http://localhost:3000/api/wholesale";
  assert.equal(isSameOrigin(new Headers({ origin: "http://127.0.0.1:3103", host: "127.0.0.1:3103" }), internal), true);
  assert.equal(isSameOrigin(new Headers({ origin: "https://marianascoffee.com", host: "internal:80", "x-forwarded-host": "marianascoffee.com" }), internal), true);
  assert.equal(isSameOrigin(new Headers({ origin: "https://evil.example", host: "marianascoffee.com" }), internal), false);
});

test("client key uses the first forwarded address", () => {
  assert.equal(clientKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  assert.equal(clientKey(new Headers()), "unknown");
});

test("readJsonBody enforces content type, size and JSON", async () => {
  const req = (body: string, type = "application/json") => new Request("https://x.test/api", { method: "POST", headers: { "content-type": type }, body });
  assert.deepEqual(await readJsonBody(req('{"a":1}'), 100), { ok: true, value: { a: 1 } });
  assert.deepEqual(await readJsonBody(req("a=1", "application/x-www-form-urlencoded"), 100), { ok: false, status: 415 });
  assert.deepEqual(await readJsonBody(req(JSON.stringify({ a: "x".repeat(200) })), 100), { ok: false, status: 413 });
  assert.deepEqual(await readJsonBody(req("{oops"), 100), { ok: false, status: 400 });
});
