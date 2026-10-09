import { test, expect } from "vitest";
import { barHeights, familyErrorText, formatPlayTime, weekdayOf } from "./familyFormat";

test("play time reads like a person would say it", () => {
  expect(formatPlayTime(0)).toBe("0 min");
  expect(formatPlayTime(29_000)).toBe("0 min");
  expect(formatPlayTime(45 * 60_000)).toBe("45 min");
  expect(formatPlayTime(60 * 60_000)).toBe("1 h");
  expect(formatPlayTime(65 * 60_000)).toBe("1 h 5 min");
});

test("weekday of a calendar day, whatever the device time zone", () => {
  expect(weekdayOf("2026-10-05")).toBe("Mon");
  expect(weekdayOf("2026-10-11")).toBe("Sun");
  expect(weekdayOf("nope")).toBe("");
});

test("bars scale to the busiest day", () => {
  expect(barHeights([0, 30, 60])).toEqual([0, 50, 100]);
  expect(barHeights([0, 0])).toEqual([0, 0]);
});

test("unknown errors get a gentle default", () => {
  expect(familyErrorText("code_expired")).toMatch(/run out/);
  expect(familyErrorText(undefined)).toBe("That didn't work. Try again?");
});
