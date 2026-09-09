import { describe, test, mock } from "node:test";
import * as assert from "node:assert";
import { hrefWithParams } from "./routes";

describe("hrefWithParams", () => {
  test("returns plain string when params is empty", () => {
    assert.strictEqual(hrefWithParams("/path", {}), "/path");
  });

  test("returns plain string when params only has empty strings", () => {
    assert.strictEqual(hrefWithParams("/path", { a: "", b: "   " }), "/path");
  });

  test("returns plain string when params only has empty arrays", () => {
    assert.strictEqual(hrefWithParams("/path", { a: [] }), "/path");
  });

  test("returns plain string when params only has null/undefined", () => {
    assert.strictEqual(hrefWithParams("/path", { a: null, b: undefined }), "/path");
  });

  test("returns object with params when valid params provided", () => {
    assert.deepStrictEqual(hrefWithParams("/path", { a: "1", b: 2, c: true, d: ["x", "y"] }), {
      pathname: "/path",
      params: { a: "1", b: 2, c: true, d: ["x", "y"] },
    });
  });

  test("filters out empty values but keeps valid ones", () => {
    assert.deepStrictEqual(
      hrefWithParams("/path", { a: "1", b: "", c: null, d: undefined, e: [], f: "  ", g: 0 }),
      {
        pathname: "/path",
        params: { a: "1", g: 0 },
      }
    );
  });
});
