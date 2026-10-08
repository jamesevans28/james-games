import { test } from "vitest";
import assert from "node:assert/strict";
import { AVATARS, avatarFor } from "./avatars.ts";

test("current ids map to themselves", () => {
  for (const a of AVATARS) assert.equal(avatarFor(a.id).id, a.id);
});

test("old sprite-sheet numbers wrap onto the set", () => {
  assert.equal(avatarFor(9).id, 1);
  assert.equal(avatarFor(89).id, ((89 - 1) % AVATARS.length) + 1);
});

test("missing or junk values fall back to avatar 1", () => {
  for (const v of [undefined, null, 0, -3, 2.5, "x", NaN]) assert.equal(avatarFor(v).id, 1);
  assert.equal(avatarFor("4").id, 4);
});
