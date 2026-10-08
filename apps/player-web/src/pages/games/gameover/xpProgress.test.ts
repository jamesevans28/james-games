import { test, expect } from "vitest";
import { xpSegments } from "./xpProgress";

const xp = (level: number, progress: number, required = 100) => ({ level, progress, required });

test("nothing known draws nothing", () => {
  expect(xpSegments(null, null)).toEqual([]);
});

test("before the result arrives the bar holds still", () => {
  expect(xpSegments(xp(2, 40), null)).toEqual([{ level: 2, fromPct: 40, toPct: 40 }]);
});

test("same level fills from the old progress to the new", () => {
  expect(xpSegments(xp(2, 40), xp(2, 70))).toEqual([{ level: 2, fromPct: 40, toPct: 70 }]);
});

test("a level up fills to the end, then starts the new level from empty", () => {
  expect(xpSegments(xp(2, 90), xp(3, 20, 200))).toEqual([
    { level: 2, fromPct: 90, toPct: 100 },
    { level: 3, fromPct: 0, toPct: 10 },
  ]);
});

test("no starting XP shows the result without animating", () => {
  expect(xpSegments(null, xp(1, 50))).toEqual([{ level: 1, fromPct: 50, toPct: 50 }]);
});

test("odd values are clamped", () => {
  expect(xpSegments(xp(1, 150), xp(1, 0, 0))).toEqual([{ level: 1, fromPct: 0, toPct: 0 }]);
});
