import { test } from "node:test";
import assert from "node:assert/strict";
import { cheerFor } from "./cheer.ts";

test("zero or missing score encourages another go", () => {
  assert.deepEqual(cheerFor(0, 10), { headline: "Have another go!", isNewBest: false });
  assert.deepEqual(cheerFor(null, 0), { headline: "Have another go!", isNewBest: false });
});
test("beating the previous best is a new best (including the very first score)", () => {
  assert.equal(cheerFor(11, 10).isNewBest, true);
  assert.equal(cheerFor(3, 0).headline, "New best!");
});
test("a tie is not a new best", () => assert.deepEqual(cheerFor(10, 10), { headline: "You matched your best!", isNewBest: false }));
test("below the best is a nice run, never a random superlative", () => assert.equal(cheerFor(3, 40).headline, "Nice run!"));
