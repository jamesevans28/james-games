import { test } from "vitest";
import assert from "node:assert/strict";
import { isUsernameTakenByOther } from "./usernamePolicy.js";

test("a free username is not taken", () => {
  assert.equal(isUsernameTakenByOther(null, "uid-a"), false);
  assert.equal(isUsernameTakenByOther(undefined, "uid-a"), false);
});

test("the owner can re-register their own username", () => {
  assert.equal(isUsernameTakenByOther({ userId: "uid-a" }, "uid-a"), false);
});

test("another account's username is taken", () => {
  assert.equal(isUsernameTakenByOther({ userId: "uid-b" }, "uid-a"), true);
});

test("a migrated account's username is taken too (no reclaim by name)", () => {
  const migrated = { userId: "uid-b", accountType: "migrated" };
  assert.equal(isUsernameTakenByOther(migrated, "uid-a"), true);
});
