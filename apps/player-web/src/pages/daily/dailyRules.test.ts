import { test, expect } from "vitest";
import {
  dailyGameFor,
  dailyPlayPath,
  dailyRunFor,
  dailySeedFor,
  dayLabel,
  isDay,
  localDay,
} from "./dailyRules";

// The same pinned values as apps/backend-api/src/services/dailyRules.test.ts.
test("the daily seed matches the server's", () => {
  expect(dailySeedFor("2026-10-09")).toBe(772954410);
  expect(dailySeedFor("2026-10-10")).toBe(554698268);
});

test("the fallback daily game matches the server's rotation", () => {
  expect(
    ["2026-10-09", "2026-10-10", "2026-10-11"].map((d) => dailyGameFor(d, ["a", "b", "c"])),
  ).toEqual(["c", "b", "c"]);
  expect(dailyGameFor("2026-10-09", ["c", "a", "b"])).toBe("c");
  expect(dailyGameFor("2026-10-09", [])).toBeNull();
});

test("isDay accepts real calendar days only", () => {
  expect(isDay("2026-10-09")).toBe(true);
  expect(isDay("2026-02-30")).toBe(false);
  expect(isDay("2026-1-9")).toBe(false);
  expect(isDay(null)).toBe(false);
});

test("a daily link only plays as the daily on its own day", () => {
  const now = Date.now();
  const today = localDay(now);
  expect(dailyRunFor(today, now)).toEqual({ day: today, seed: dailySeedFor(today) });
  expect(dailyRunFor("2020-01-01", now)).toBeUndefined();
  expect(dailyRunFor(null, now)).toBeUndefined();
  expect(dailyRunFor("soon", now)).toBeUndefined();
  expect(dailyPlayPath("reflex-ring", "2026-10-09")).toBe("/games/reflex-ring?daily=2026-10-09");
});

test("the day label names the weekday whatever the device's time zone", () => {
  expect(dayLabel("2026-10-09", "en-GB")).toBe("Friday 9 October");
});
