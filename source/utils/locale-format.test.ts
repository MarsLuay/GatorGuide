import { describe, it } from "node:test";
import assert from "node:assert";
import { formatLocalizedCurrency } from "./locale-format.ts";

describe("formatLocalizedCurrency", () => {
  it("formats currency correctly in US locale by default", () => {
    assert.strictEqual(formatLocalizedCurrency(1000), "$1,000");
    assert.strictEqual(formatLocalizedCurrency(1000.5), "$1,001");
  });

  it("formats currency correctly for other locales", () => {
    assert.strictEqual(formatLocalizedCurrency(1000, "Spanish"), "1000\xa0US$");
    assert.strictEqual(formatLocalizedCurrency(1000, "Chinese (Simplified)"), "US$1,000");
    assert.strictEqual(formatLocalizedCurrency(1000, "French"), "1\u202f000\xa0$US");
  });

  it("accepts custom options", () => {
    assert.strictEqual(
      formatLocalizedCurrency(1000, "English", { maximumFractionDigits: 2 }),
      "$1,000.00"
    );
    assert.strictEqual(
      formatLocalizedCurrency(1000.5, "English", { maximumFractionDigits: 2 }),
      "$1,000.50"
    );
  });

  it("formats 0 correctly", () => {
    assert.strictEqual(formatLocalizedCurrency(0), "$0");
  });

  it("formats negative numbers correctly", () => {
    assert.strictEqual(formatLocalizedCurrency(-1000), "-$1,000");
  });
});
