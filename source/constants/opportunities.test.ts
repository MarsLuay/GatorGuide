import test from "node:test";
import assert from "node:assert";
import { normalizeOpportunityDate } from "./opportunities";

test("normalizeOpportunityDate", async (t) => {
  await t.test("returns ISO string for valid date string", () => {
    assert.strictEqual(normalizeOpportunityDate("2024-01-01T00:00:00.000Z"), "2024-01-01T00:00:00.000Z");
  });

  await t.test("returns null for empty string", () => {
    assert.strictEqual(normalizeOpportunityDate(""), null);
  });

  await t.test("returns null for undefined", () => {
    assert.strictEqual(normalizeOpportunityDate(undefined), null);
  });

  await t.test("returns ISO string for object with valid toDate method", () => {
    const mockTimestamp = {
      toDate: () => new Date("2024-01-01T00:00:00.000Z"),
    };
    assert.strictEqual(normalizeOpportunityDate(mockTimestamp), "2024-01-01T00:00:00.000Z");
  });

  await t.test("returns null when toDate method throws an error", () => {
    const mockBrokenTimestamp = {
      toDate: () => {
        throw new Error("Simulated toDate error");
      },
    };
    assert.strictEqual(normalizeOpportunityDate(mockBrokenTimestamp), null);
  });
});
