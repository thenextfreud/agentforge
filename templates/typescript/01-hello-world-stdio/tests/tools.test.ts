import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { success, failure, wrapHandler } from "../src/lib/errors.js";

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
