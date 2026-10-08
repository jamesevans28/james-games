import { test } from "vitest";
import assert from "node:assert/strict";
import { errorFields, log, safeFields } from "./log.js";

test("drops identifying field names whatever their value", () => {
  assert.deepEqual(
    safeFields({
      email: "a@b.co",
      userId: "u1",
      UID: "u2",
      username: "kid",
      screenName: "Koala",
      gameId: "snapadile",
      count: 3,
    }),
    { gameId: "snapadile", count: 3 },
  );
});

test("scrubs emails hidden inside allowed string fields", () => {
  assert.equal(safeFields({ note: "sent to kid@example.com ok" }).note, "sent to [email] ok");
});

test("reduces errors to name, code and a scrubbed message", () => {
  const err = Object.assign(new Error("user kid@example.com not found"), {
    code: "auth/user-not-found",
    token: "secret",
  });
  const f = errorFields(err);
  assert.deepEqual(f, {
    errorName: "Error",
    errorCode: "auth/user-not-found",
    errorMessage: "user [email] not found",
  });
  assert.ok(!JSON.stringify(f).includes("secret"));
});

test("emits one JSON line without identities", () => {
  const lines: string[] = [];
  const orig = console.error;
  console.error = (l: string) => lines.push(l);
  try {
    log.error("login_failed", { userId: "u1", reason: "bad_pin" }, new Error("boom"));
  } finally {
    console.error = orig;
  }
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.event, "login_failed");
  assert.equal(parsed.reason, "bad_pin");
  assert.equal(parsed.userId, undefined);
});
