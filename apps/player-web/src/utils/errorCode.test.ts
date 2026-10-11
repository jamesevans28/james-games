import { test } from "vitest";
import assert from "node:assert/strict";
import { errorCode, errorMessage } from "./errorCode.ts";

test("errorCode prefers code, then name, never the message", () => {
  assert.equal(errorCode({ code: "otp_expired", name: "AuthApiError" }), "otp_expired");
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

test("errorMessage turns Supabase auth codes into friendly text and hides raw auth messages", () => {
  const authError = (code: string | undefined, message: string) =>
    Object.assign(new Error(message), { __isAuthError: true, code, status: 400 });
  assert.equal(
    errorMessage(authError("otp_expired", "Email link is invalid or has expired"), "fallback"),
    "That code didn't work, or it ran out. Please try again.",
  );
  assert.equal(
    errorMessage(authError("identity_already_exists", "Identity is already linked"), "fallback"),
    "That account is already joined to a different player.",
  );
  assert.equal(
    errorMessage(authError("over_request_rate_limit", "Request rate limit reached"), "x"),
    "Too many tries. Take a break and try again in a little while.",
  );
  assert.equal(
    errorMessage(authError("email_exists", "A user with this email already exists"), "x"),
    "That email is already on another account.",
  );
  assert.equal(errorMessage(authError("some_new_code", "internal detail"), "fallback"), "fallback");
  assert.equal(errorMessage(authError(undefined, "internal detail"), "fallback"), "fallback");
});
