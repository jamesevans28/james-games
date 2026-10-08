import { test, expect } from "vitest";
import { mulberry32 } from "../../../platform/rng";
import {
  approach,
  between,
  comboNext,
  gravityAt,
  GRAVITY_MAX,
  GRAVITY_START,
  HOOP_GAP_MAX,
  HOOP_GAP_MIN,
  HOOP_Y_MAX,
  HOOP_Y_MIN,
  MAX_COMBO,
  nextHoop,
  passQuality,
  pointsFor,
} from "./rules";

const GAP = 116;

test("through the middle is perfect, off-centre is good", () => {
  expect(passQuality(200, 200, GAP)).toBe("perfect");
  expect(passQuality(217, 200, GAP)).toBe("perfect"); // 17 ≤ 116 × 0.15
  expect(passQuality(183, 200, GAP)).toBe("perfect");
  expect(passQuality(230, 200, GAP)).toBe("good");
  expect(passQuality(258, 200, GAP)).toBe("good"); // right at the edge of the opening
});

test("outside the opening is a miss", () => {
  expect(passQuality(259, 200, GAP)).toBe("miss");
  expect(passQuality(100, 200, GAP)).toBe("miss");
  expect(passQuality(200, 200, 0)).toBe("miss");
  expect(passQuality(200, 200, Number.NaN)).toBe("miss");
});

test("touching the rim on the way through is a rim pass, never perfect", () => {
  expect(passQuality(200, 200, GAP, true)).toBe("rim");
  expect(passQuality(240, 200, GAP, true)).toBe("rim");
  expect(passQuality(300, 200, GAP, true)).toBe("miss");
});

test("clean passes grow the combo to a cap; rim and miss reset it", () => {
  expect(comboNext(1, "good")).toBe(2);
  expect(comboNext(2, "perfect")).toBe(3);
  expect(comboNext(MAX_COMBO, "perfect")).toBe(MAX_COMBO);
  expect(comboNext(7, "rim")).toBe(1);
  expect(comboNext(7, "miss")).toBe(1);
  expect(comboNext(0, "good")).toBe(2); // a bad combo value is treated as 1
});

test("points: combo for good, double for perfect, 1 for a rim pass", () => {
  expect(pointsFor(1, "good")).toBe(1);
  expect(pointsFor(4, "good")).toBe(4);
  expect(pointsFor(4, "perfect")).toBe(8);
  expect(pointsFor(9, "rim")).toBe(1);
  expect(pointsFor(9, "miss")).toBe(0);
  expect(pointsFor(99, "perfect")).toBe(MAX_COMBO * 2);
});

test("a run of perfect passes tops out at 20 points a hoop", () => {
  let combo = 1;
  const points: number[] = [];
  for (let i = 0; i < 12; i++) {
    points.push(pointsFor(combo, "perfect"));
    combo = comboNext(combo, "perfect");
  }
  expect(points.slice(0, 4)).toEqual([2, 4, 6, 8]);
  expect(Math.max(...points)).toBe(20);
});

test("gravity starts gentle, ramps, and caps", () => {
  expect(gravityAt(0)).toBe(GRAVITY_START);
  expect(gravityAt(-500)).toBe(GRAVITY_START);
  expect(gravityAt(2000)).toBe(860);
  expect(gravityAt(60_000)).toBe(GRAVITY_MAX);
  let prev = gravityAt(0);
  for (let t = 0; t <= 10_000; t += 250) {
    expect(gravityAt(t)).toBeGreaterThanOrEqual(prev);
    prev = gravityAt(t);
  }
});

test("between covers both ends and stays in range", () => {
  expect(between(() => 0, 3, 7)).toBe(3);
  expect(between(() => 0.999999, 3, 7)).toBe(7);
  expect(between(() => 1, 3, 7)).toBe(7);
  expect(between(() => -1, 3, 7)).toBe(3);
});

test("hoops spawn in range, repeatably by seed", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 200; i++) {
    const h = nextHoop(a);
    expect(h).toEqual(nextHoop(b));
    expect(h.gap).toBeGreaterThanOrEqual(HOOP_GAP_MIN);
    expect(h.gap).toBeLessThanOrEqual(HOOP_GAP_MAX);
    expect(h.y).toBeGreaterThanOrEqual(HOOP_Y_MIN);
    expect(h.y).toBeLessThanOrEqual(HOOP_Y_MAX);
  }
});

test("approach eases the same distance whatever the frame rate", () => {
  expect(approach(100, 0, 0.5, 1 / 60)).toBeCloseTo(50);
  const at60 = approach(100, 0, 0.08, 1 / 60);
  let at120 = 100;
  at120 = approach(at120, 0, 0.08, 1 / 120);
  at120 = approach(at120, 0, 0.08, 1 / 120);
  expect(at120).toBeCloseTo(at60);
  expect(approach(100, 0, 0.08, 0)).toBe(100);
  expect(approach(100, 0, 1, 1 / 60)).toBe(0);
});
