import { test } from "vitest";
import assert from "node:assert/strict";
import { errorCode, errorMessage } from "./errorCode.ts";

test("errorCode prefers code, then name, never the message", () => {
  assert.equal(errorCode({ code: "auth/x", name: "FirebaseError" }), "auth/x");
  assert.equal(errorCode(new TypeError("secret")), "TypeError");
  assert.equal(errorCode("boom"), "error");
});

test("errorMessage uses a non-empty message, otherwise the fallback", () => {
  assert.equal(errorMessage(new Error("signin_required"), "fallback"), "signin_required");
  assert.equal(errorMessage({ message: "plain object" }, "fallback"), "plain object");
  assert.equal(errorMessage(new Error(""), "fallback"), "fallback");
  assert.equal(errorMessage(null, "fallback"), "fallback");
  assert.equal(errorMessage("boom", "fallback"), "fallback");
});
