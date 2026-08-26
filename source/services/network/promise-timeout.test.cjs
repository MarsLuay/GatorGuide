require("ts-node").register({
  skipProject: true,
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
    jsx: "react-jsx",
    baseUrl: ".",
    paths: {
      "@/*": ["./*"],
    },
  },
});
require("tsconfig-paths/register");

const assert = require("node:assert/strict");
const test = require("node:test");
const { setTimeout: delay } = require("node:timers/promises");

const { withPromiseTimeout, withTimeout, TimeoutError } = require("@/services/network/promise-timeout");

test.describe("TimeoutError", () => {
  test.it("should create an error with default message", () => {
    const error = new TimeoutError();
    assert.strictEqual(error.message, "Operation timed out");
    assert.strictEqual(error.name, "TimeoutError");
  });

  test.it("should create an error with custom message", () => {
    const error = new TimeoutError("Custom timeout");
    assert.strictEqual(error.message, "Custom timeout");
    assert.strictEqual(error.name, "TimeoutError");
  });
});

test.describe("withTimeout", () => {
  test.it("should resolve if promise resolves before timeout", async () => {
    const promise = delay(10, "resolved value");
    const result = await withTimeout(promise, 50);
    assert.strictEqual(result, "resolved value");
  });

  test.it("should reject if promise rejects before timeout", async () => {
    const error = new Error("promise rejected");
    const promise = Promise.reject(error);
    await assert.rejects(
      () => withTimeout(promise, 50),
      (err) => err === error
    );
  });

  test.it("should reject with TimeoutError if promise takes too long", async () => {
    const promise = delay(100, "resolved value");
    await assert.rejects(
      () => withTimeout(promise, 10, "timeout error custom"),
      (err) => err instanceof TimeoutError && err.message === "timeout error custom"
    );
  });

  test.it("should reject with default TimeoutError if taking too long", async () => {
    const promise = delay(100, "resolved value");
    await assert.rejects(
      () => withTimeout(promise, 10),
      (err) => err instanceof TimeoutError && err.message === "Operation timed out"
    );
  });
});

test.describe("withPromiseTimeout", () => {
  test.it("should resolve if promise resolves before timeout", async () => {
    const promise = delay(10, "resolved value");
    const result = await withPromiseTimeout(promise, 50, () => new Error("timeout"));
    assert.strictEqual(result, "resolved value");
  });

  test.it("should reject if promise rejects before timeout", async () => {
    const error = new Error("promise rejected");
    const promise = Promise.reject(error);
    await assert.rejects(
      () => withPromiseTimeout(promise, 50, () => new Error("timeout")),
      (err) => err === error
    );
  });

  test.it("should reject with timeout error if promise takes too long", async () => {
    const promise = delay(100, "resolved value");
    await assert.rejects(
      () => withPromiseTimeout(promise, 10, () => new Error("timeout error")),
      (err) => err.message === "timeout error"
    );
  });
});
