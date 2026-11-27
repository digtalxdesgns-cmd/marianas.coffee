// Run with `node --test "tests/**/*.test.ts"` (Node's built-in test runner).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  commerceDictionary,
  extractPrintfPlaceholders,
  extractTemplatePlaceholders,
  getStorefrontCopy,
  listAllWooEntries,
  translateWooString,
} from "../lib/i18n/commerce.ts";
import { SUPPORTED_LOCALES } from "../lib/woo/config.ts";

function collectLeafStrings(obj: unknown, prefix = ""): Array<{ key: string; value: string }> {
  if (typeof obj === "string") return [{ key: prefix, value: obj }];
  if (!obj || typeof obj !== "object") return [];
  const results: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    results.push(...collectLeafStrings(v, prefix ? `${prefix}.${k}` : k));
  }
  return results;
}

test("Next.js and WordPress staging translation JSON dictionaries are identical (single source of truth)", () => {
  const nextJson = fs.readFileSync(
    path.resolve("lib/i18n/commerce-translations.json"),
    "utf8",
  );
  const wpJson = fs.readFileSync(
    path.resolve("wordpress/staging/mu-plugins/marianas-i18n/translations.json"),
    "utf8",
  );
  assert.deepEqual(JSON.parse(wpJson), JSON.parse(nextJson));
});

test("storefront dictionary covers all four languages with matching keys, template tokens, and safe plain text", () => {
  const enLeaves = collectLeafStrings(commerceDictionary.storefront.en);
  assert.ok(enLeaves.length > 30);

  const enMap = new Map(enLeaves.map((entry) => [entry.key, entry.value]));

  for (const locale of SUPPORTED_LOCALES) {
    const leaves = collectLeafStrings(commerceDictionary.storefront[locale]);
    assert.equal(leaves.length, enLeaves.length, `${locale} key count matches en`);
    for (const { key, value } of leaves) {
      assert.ok(value.trim().length > 0, `${locale}.${key} is non-empty`);
      assert.equal(/<script|onerror=|onload=|javascript:/i.test(value), false, `${locale}.${key} is safe plain text`);
      const enVal = enMap.get(key) ?? "";
      assert.deepEqual(
        extractTemplatePlaceholders(value),
        extractTemplatePlaceholders(enVal),
        `${locale}.${key} preserves template tokens`,
      );
    }
  }
});

test("WooCommerce custom dictionary covers all required categories with printf placeholder parity and unique sources", () => {
  const expectedCategories = [
    "cart",
    "checkout",
    "shipping",
    "payment",
    "validation",
    "orderConfirmation",
    "emails",
  ];
  for (const category of expectedCategories) {
    assert.ok(
      Array.isArray(commerceDictionary.woocommerce.categories[category]) &&
        commerceDictionary.woocommerce.categories[category].length > 0,
      `category ${category} present`,
    );
  }

  const entries = listAllWooEntries();
  const seenKeys = new Set<string>();
  const seenSources = new Set<string>();

  for (const entry of entries) {
    assert.ok(entry.key.length > 0);
    assert.ok(entry.source.length > 0);
    assert.equal(seenKeys.has(entry.key), false, `unique key ${entry.key}`);
    assert.equal(seenSources.has(entry.source), false, `unique source ${entry.source}`);
    seenKeys.add(entry.key);
    seenSources.add(entry.source);

    const expectedPlaceholders = extractPrintfPlaceholders(entry.source);
    for (const lang of ["zh", "ko", "ja"] as const) {
      const value = entry[lang];
      assert.ok(value.trim().length > 0, `${entry.key}.${lang} non-empty`);
      assert.equal(/<script|onerror=|onload=|javascript:/i.test(value), false, `${entry.key}.${lang} safe`);
      assert.deepEqual(
        extractPrintfPlaceholders(value),
        expectedPlaceholders,
        `${entry.key}.${lang} preserves printf placeholders`,
      );
    }
  }
});

test("translateWooString translates covered strings and falls back safely for unknown strings or en", () => {
  assert.equal(translateWooString("Place order", "en"), "Place order");
  assert.equal(translateWooString("Place order", "zh"), "提交订单");
  assert.equal(translateWooString("Place order", "ko"), "주문 완료하기");
  assert.equal(translateWooString("Place order", "ja"), "注文を確定する");
  assert.equal(translateWooString("Hi %s,", "ja"), "%s様");
  assert.equal(
    translateWooString("Third-party plugin notice not in dictionary", "ja"),
    "Third-party plugin notice not in dictionary",
  );
  assert.equal(getStorefrontCopy("unsupported").title, commerceDictionary.storefront.en.title);
});
