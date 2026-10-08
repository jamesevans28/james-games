import { test } from "vitest";
import assert from "node:assert/strict";
import { errorInfo, isConditionalCheckFailed } from "./errors.ts";

test("reads string fields from errors and plain objects", () => {
  const e = Object.assign(new Error("boom"), { code: "E1" });
  assert.deepEqual(errorInfo(e), { message: "boom", name: "Error", code: "E1" });
  assert.deepEqual(errorInfo({ code: 42, message: "x" }), {
    message: "x",
    name: undefined,
    code: undefined,
  });
});

test("anything else gives an empty object", () => {
  for (const v of [undefined, null, "boom", 3]) assert.deepEqual(errorInfo(v), {});
});

test("spots DynamoDB conditional failures", () => {
  assert.equal(isConditionalCheckFailed({ name: "ConditionalCheckFailedException" }), true);
  assert.equal(isConditionalCheckFailed(new Error("nope")), false);
});
