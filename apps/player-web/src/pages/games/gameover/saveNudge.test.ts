import { test, expect } from "vitest";
import { shouldShowSaveNudge } from "./saveNudge";

// Local-time dates so the tests hold in any time zone.
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();

test("signed-in players never see the nudge", () => {
  expect(shouldShowSaveNudge({ isGuest: false, lastShownAt: null, now: at(9, 10) })).toBe(false);
});

test("a guest sees it the first time", () => {
  expect(shouldShowSaveNudge({ isGuest: true, lastShownAt: null, now: at(9, 10) })).toBe(true);
});

test("a guest sees it at most once per day", () => {
  const shown = at(9, 8);
  expect(shouldShowSaveNudge({ isGuest: true, lastShownAt: shown, now: at(9, 8, 5) })).toBe(false);
  expect(shouldShowSaveNudge({ isGuest: true, lastShownAt: shown, now: at(9, 23, 59) })).toBe(
    false,
  );
  expect(shouldShowSaveNudge({ isGuest: true, lastShownAt: shown, now: at(10, 0, 1) })).toBe(true);
});

test("a late-night show still allows it the next morning", () => {
  expect(shouldShowSaveNudge({ isGuest: true, lastShownAt: at(9, 23, 50), now: at(10, 7) })).toBe(
    true,
  );
});

test("a clock that moved backwards does not re-show it", () => {
  expect(shouldShowSaveNudge({ isGuest: true, lastShownAt: at(10, 9), now: at(9, 9) })).toBe(false);
});

test("junk stored values count as never shown", () => {
  expect(shouldShowSaveNudge({ isGuest: true, lastShownAt: NaN, now: at(9, 9) })).toBe(true);
});
