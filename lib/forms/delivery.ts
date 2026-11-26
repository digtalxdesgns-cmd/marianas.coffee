import { appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { WholesaleLead } from "./validation";

/**
 * Where form submissions go. No external provider is wired in yet: one must be
 * approved first (see the architecture doc, M1). Until then the endpoints
 * report "unavailable" instead of pretending to succeed.
 *
 * Local testing only: set FORM_DELIVERY=local-test in `.env.local` to append
 * synthetic submissions to a file in the OS temp folder. This mode is refused
 * when NODE_ENV is "production" or when running on Vercel.
 */

export type WholesaleDelivery = {
  name: string;
  deliver: (lead: WholesaleLead, meta: { receivedAt: string }) => Promise<void>;
};

export type NewsletterResult = "subscribed" | "pending";

export type NewsletterDelivery = {
  name: string;
  subscribe: (email: string, meta: { receivedAt: string }) => Promise<NewsletterResult>;
};

function localTestEnabled(): boolean {
  return (
    process.env.FORM_DELIVERY === "local-test" &&
    process.env.NODE_ENV !== "production" &&
    !process.env.VERCEL
  );
}

export const LOCAL_TEST_FILE = path.join(tmpdir(), "marianas-coffee-form-tests.jsonl");

async function appendLocal(record: Record<string, unknown>) {
  await appendFile(LOCAL_TEST_FILE, JSON.stringify(record) + "\n", "utf8");
}

export function getWholesaleDelivery(): WholesaleDelivery | null {
  if (localTestEnabled()) {
    return {
      name: "local-test",
      deliver: (lead, meta) => appendLocal({ kind: "wholesale", ...lead, ...meta }),
    };
  }
  return null;
}

export function getNewsletterDelivery(): NewsletterDelivery | null {
  if (localTestEnabled()) {
    return {
      name: "local-test",
      subscribe: async (email, meta) => {
        await appendLocal({ kind: "newsletter", email, ...meta });
        // Mirrors a double opt-in provider: the address is pending until confirmed.
        return "pending";
      },
    };
  }
  return null;
}
