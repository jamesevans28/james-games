import { test } from "vitest";
import assert from "node:assert/strict";
import {
  clampTzOffset,
  isoWeekOf,
  localDayFor,
  localWeekFor,
  nextStreak,
  weeklyStickerFor,
  weeklyStickerId,
} from "./streakRules.js";

const at = (iso: string) => Date.parse(iso);

test("local day uses the server clock plus a clamped offset", () => {
  assert.equal(localDayFor(at("2026-10-08T20:00:00Z"), 0), "2026-10-08");
  assert.equal(localDayFor(at("2026-10-08T20:00:00Z"), 660), "2026-10-09"); // Sydney, daylight time
  assert.equal(
    localDayFor(at("2026-10-08T20:00:00Z"), 99_999),
    localDayFor(at("2026-10-08T20:00:00Z"), 840),
  );
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
  const r = nextStreak(
    { currentStreak: 4, longestStreak: 4, lastLoginDate: "2026-09-30" },
    "2026-10-01",
  );
  assert.deepEqual(r.next, { currentStreak: 5, longestStreak: 5, lastLoginDate: "2026-10-01" });
  assert.equal(r.extended, true);
});

test("a gap restarts at 1 and keeps the longest", () => {
  const r = nextStreak(
    { currentStreak: 6, longestStreak: 9, lastLoginDate: "2026-10-01" },
    "2026-10-08",
  );
  assert.deepEqual(r.next, { currentStreak: 1, longestStreak: 9, lastLoginDate: "2026-10-08" });
  assert.equal(r.isNewStreak, true);
});

test("same day or an earlier day changes nothing (no farming by date)", () => {
  const s = { currentStreak: 3, longestStreak: 3, lastLoginDate: "2026-10-08" };
  assert.equal(nextStreak(s, "2026-10-08").changed, false);
  assert.equal(nextStreak(s, "2026-10-07").changed, false);
});

test("ISO weeks start on Monday and the first Thursday decides the year", () => {
  assert.deepEqual(isoWeekOf("2026-10-09"), { isoYear: 2026, isoWeek: 41 });
  assert.deepEqual(isoWeekOf("2026-10-05"), { isoYear: 2026, isoWeek: 41 }); // Monday
  assert.deepEqual(isoWeekOf("2026-10-11"), { isoYear: 2026, isoWeek: 41 }); // Sunday
  assert.deepEqual(isoWeekOf("2026-10-12"), { isoYear: 2026, isoWeek: 42 });
  assert.deepEqual(isoWeekOf("2027-01-01"), { isoYear: 2026, isoWeek: 53 });
  assert.deepEqual(isoWeekOf("2027-01-04"), { isoYear: 2027, isoWeek: 1 });
  assert.deepEqual(isoWeekOf("2024-12-30"), { isoYear: 2025, isoWeek: 1 });
  assert.deepEqual(isoWeekOf("2021-01-03"), { isoYear: 2020, isoWeek: 53 });
  assert.equal(weeklyStickerId("2026-10-09"), "week-2026-41");
  assert.equal(weeklyStickerId("2027-01-04"), "week-2027-01");
});

test("the local week window follows the player's offset", () => {
  // Friday 9 Oct 2026, 20:00 UTC is already Saturday in Sydney (+11:00).
  const utc = localWeekFor(at("2026-10-09T20:00:00Z"), 0);
  assert.equal(utc.today, "2026-10-09");
  assert.equal(utc.startMs, at("2026-10-05T00:00:00Z"));
  assert.equal(utc.endMs, at("2026-10-12T00:00:00Z"));
  assert.equal(utc.stickerId, "week-2026-41");

  const sydney = localWeekFor(at("2026-10-09T20:00:00Z"), 660);
  assert.equal(sydney.today, "2026-10-10");
  assert.equal(sydney.startMs, at("2026-10-04T13:00:00Z")); // Monday 00:00 in Sydney
  assert.equal(sydney.endMs, at("2026-10-11T13:00:00Z"));

  // Sunday night in New York (-4:00) is Monday in UTC: still last week locally.
  const ny = localWeekFor(at("2026-10-12T02:00:00Z"), -240);
  assert.equal(ny.today, "2026-10-11");
  assert.equal(ny.stickerId, "week-2026-41");
  assert.equal(localWeekFor(at("2026-10-12T02:00:00Z"), "-240").tzOffsetMinutes, 0);
});

test("three different days in this week collect the weekly sticker", () => {
  const today = "2026-10-09";
  assert.equal(weeklyStickerFor(["2026-10-05", "2026-10-07", today], today), "week-2026-41");
  // Many plays on two days are still two days.
  assert.equal(weeklyStickerFor(["2026-10-07", "2026-10-07", today, today], today), null);
  // Days from last week do not count towards this one.
  assert.equal(weeklyStickerFor(["2026-10-03", "2026-10-04", today], today), null);
  // Across the new year the ISO week still holds together.
  assert.equal(
    weeklyStickerFor(["2026-12-28", "2026-12-31", "2027-01-02"], "2027-01-02"),
    "week-2026-53",
  );
});
