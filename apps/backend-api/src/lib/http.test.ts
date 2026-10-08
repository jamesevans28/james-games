import { test } from "vitest";
import assert from "node:assert/strict";
import { publicErrorFor, statusFor } from "./http.js";

test("explicit 4xx statuses are kept; anything else is 500", () => {
  assert.equal(statusFor(Object.assign(new Error("x"), { status: 404 })), 404);
  assert.equal(statusFor(Object.assign(new Error("x"), { statusCode: 503 })), 500);
  assert.equal(statusFor(new Error("boom")), 500);
  assert.equal(statusFor("string error"), 500);
});

test("known codes and body-parser errors map to client errors", () => {
  assert.equal(statusFor(Object.assign(new Error("dup"), { code: "CONFLICT" })), 409);
  assert.equal(statusFor({ type: "entity.parse.failed" }), 400);
});

test("server errors never reveal their message", () => {
  const err = new Error("ResourceNotFoundException: games4james-users kid@example.com");
  assert.equal(publicErrorFor(err, 500), "server_error");
});

test("client errors get a stable code", () => {
  assert.equal(publicErrorFor({ type: "entity.parse.failed" }, 400), "invalid_json");
  assert.equal(publicErrorFor({ code: "CONFLICT" }, 409), "conflict");
});
