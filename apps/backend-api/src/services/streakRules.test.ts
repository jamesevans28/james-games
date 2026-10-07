import { test } from "node:test";
import assert from "node:assert/strict";
import { clampTzOffset, localDayFor, nextStreak } from "./streakRules.js";

const at = (iso: string) => Date.parse(iso);

test("local day uses the server clock plus a clamped offset", () => {
  assert.equal(localDayFor(at("2026-10-08T20:00:00Z"), 0), "2026-10-08");
  assert.equal(localDayFor(at("2026-10-08T20:00:00Z"), 660), "2026-10-09"); // Sydney, daylight time
  assert.equal(localDayFor(at("2026-10-08T20:00:00Z"), 99_999), localDayFor(at("2026-10-08T20:00:00Z"), 840));
  assert.equal(clampTzOffset("660"), 0);
  assert.equal(clampTzOffset(-10_000), -840);
});

test("first ever check-in starts at 1", () => {
  const r = nextStreak({ currentStreak: 0, longestStreak: 0, lastLoginDate: null }, "2026-10-08");
  assert.deepEqual(r.next, { currentStreak: 1, longestStreak: 1, lastLoginDate: "2026-10-08" });
  assert.equal(r.changed, true);
  assert.equal(r.isNewStreak, false);
});

test("consecutive day extends, across a month boundary", () => {
  const r = nextStreak({ currentStreak: 4, longestStreak: 4, lastLoginDate: "2026-09-30" }, "2026-10-01");
  assert.deepEqual(r.next, { currentStreak: 5, longestStreak: 5, lastLoginDate: "2026-10-01" });
  assert.equal(r.extended, true);
});

test("a gap restarts at 1 and keeps the longest", () => {
  const r = nextStreak({ currentStreak: 6, longestStreak: 9, lastLoginDate: "2026-10-01" }, "2026-10-08");
  assert.deepEqual(r.next, { currentStreak: 1, longestStreak: 9, lastLoginDate: "2026-10-08" });
  assert.equal(r.isNewStreak, true);
});

test("same day or an earlier day changes nothing (no farming by date)", () => {
  const s = { currentStreak: 3, longestStreak: 3, lastLoginDate: "2026-10-08" };
  assert.equal(nextStreak(s, "2026-10-08").changed, false);
  assert.equal(nextStreak(s, "2026-10-07").changed, false);
});
