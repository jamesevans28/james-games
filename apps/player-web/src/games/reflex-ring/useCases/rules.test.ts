import { test, expect } from "vitest";
import {
  angleDiff,
  isPerfect,
  nextVelocity,
  pickTarget,
  pointsFor,
  powerupRoll,
  POWERUPS,
  segmentHit,
} from "./rules";
import { mulberry32 } from "../../../platform/rng";

const deg = (d: number) => (d * Math.PI) / 180;

test("angle difference wraps around the circle", () => {
  expect(angleDiff(deg(350), deg(10))).toBeCloseTo(deg(-20));
  expect(angleDiff(deg(10), deg(350))).toBeCloseTo(deg(20));
  expect(angleDiff(deg(180), 0)).toBeCloseTo(Math.PI);
});

test("hits inside the wedge, with 20% forgiveness", () => {
  const width = deg(28);
  expect(segmentHit(deg(100), deg(100), width)).toBe(true);
  expect(segmentHit(deg(116), deg(100), width)).toBe(true); // 16° > 14° half-width, < 16.8° forgiven
  expect(segmentHit(deg(118), deg(100), width)).toBe(false);
  expect(segmentHit(deg(355), deg(5), width)).toBe(true); // across 0°
});

test("perfect is the centre fifth", () => {
  const width = deg(28);
  expect(isPerfect(deg(102), deg(100), width)).toBe(true);
  expect(isPerfect(deg(104), deg(100), width)).toBe(false);
  expect(pointsFor(true)).toBe(2);
  expect(pointsFor(false)).toBe(1);
});

test("velocity speeds up 3%, flips direction and caps", () => {
  expect(nextVelocity(1.5, 5)).toBeCloseTo(-1.545);
  expect(nextVelocity(-1.5, 5)).toBeCloseTo(1.545);
  expect(nextVelocity(4.99, 5)).toBe(-5);
  expect(nextVelocity(0, 5)).toBe(-0);
});

test("targets keep their distance from the last one", () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 500; i++) {
    const avoid = rng() * Math.PI * 2;
    const t = pickTarget(rng, avoid);
    const d = Math.abs(angleDiff(t, avoid));
    expect(d).toBeGreaterThanOrEqual(deg(40) - 1e-9);
    expect(d).toBeLessThanOrEqual(Math.PI + 1e-9);
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThan(Math.PI * 2);
  }
});

test("power-up roll covers every type and is repeatable by seed", () => {
  const rng = mulberry32(1);
  const seen = new Set(Array.from({ length: 200 }, () => powerupRoll(rng)));
  expect([...seen].sort()).toEqual([...POWERUPS].sort());
  expect(powerupRoll(() => 0.999999)).toBe("auto-hit");
  const a = mulberry32(3);
  const b = mulberry32(3);
  expect([powerupRoll(a), powerupRoll(a)]).toEqual([powerupRoll(b), powerupRoll(b)]);
});
