import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { success, failure, wrapHandler } from "../src/lib/errors.js";
import { isRetryableError, ApiError } from "../src/lib/retry.js";

describe("error utilities", () => {
  test("success returns content array with text", () => {
    const result = success("hello");
    assert.equal(result.content[0].type, "text");
    assert.equal(result.content[0].text, "hello");
    assert.equal(result.isError, undefined);
  });

  test("failure returns isError flag", () => {
    const result = failure({ code: "TEST", message: "failed" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /TEST/);
  });

  test("wrapHandler catches errors and returns failure", async () => {
    const handler = wrapHandler(async () => {
      throw new Error("boom");
    });
    const result = await handler({});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /boom/);
  });

  test("wrapHandler passes through success", async () => {
    const handler = wrapHandler(async () => "ok");
    const result = await handler({});
    assert.equal(result.content[0].text, "ok");
    assert.equal(result.isError, undefined);
  });
});

describe("retry utilities", () => {
  test("isRetryableError returns true for 429", () => {
    const error = new ApiError("Rate limited", 429);
    assert.equal(isRetryableError(error), true);
  });

  test("isRetryableError returns true for 503", () => {
    const error = new ApiError("Service unavailable", 503);
    assert.equal(isRetryableError(error), true);
  });

  test("isRetryableError returns false for 404", () => {
    const error = new ApiError("Not found", 404);
    assert.equal(isRetryableError(error), false);
  });

  test("isRetryableError returns false for 400", () => {
    const error = new ApiError("Bad request", 400);
    assert.equal(isRetryableError(error), false);
  });

  test("isRetryableError returns true for network errors", () => {
    const error = new Error("fetch failed");
    assert.equal(isRetryableError(error), true);
  });

  test("ApiError carries status and body", () => {
    const error = new ApiError("Server error", 500, "internal error");
    assert.equal(error.status, 500);
    assert.equal(error.body, "internal error");
    assert.equal(error.message, "Server error");
  });
});
