import { test, expect } from "vitest";
import { livesFor, loseLife, MAX_LIVES, pickSpawn, scoreFor, spawnSchedule } from "./rules";
import { mulberry32 } from "../../../platform/rng";

test("starts gentle", () => {
  expect(spawnSchedule(0)).toEqual({ intervalMs: 1000, maxConcurrent: 1, crocSpeed: 200 });
});

test("gets harder over time, to a floor", () => {
  expect(spawnSchedule(4_000).intervalMs).toBe(920);
  expect(spawnSchedule(9_000).maxConcurrent).toBe(2);
  const late = spawnSchedule(10 * 60_000);
  expect(late).toEqual({ intervalMs: 300, maxConcurrent: 6, crocSpeed: 340 });
});

test("difficulty never goes backwards", () => {
  let prev = spawnSchedule(0);
  for (let t = 0; t <= 120_000; t += 500) {
    const next = spawnSchedule(t);
    expect(next.intervalMs).toBeLessThanOrEqual(prev.intervalMs);
    expect(next.maxConcurrent).toBeGreaterThanOrEqual(prev.maxConcurrent);
    expect(next.crocSpeed).toBeGreaterThanOrEqual(prev.crocSpeed);
    prev = next;
  }
});

test("a croc already retreating can't be scored twice", () => {
  expect(scoreFor({ retreating: false })).toBe(1);
  expect(scoreFor({ retreating: true })).toBe(0);
});

test("lives", () => {
  expect(MAX_LIVES).toBe(3);
  expect(loseLife(3)).toBe(2);
  expect(loseLife(0)).toBe(0);
});

test("spawns only on free points, repeatably by seed", () => {
  const points = [{ id: "L0" }, { id: "R0" }, { id: "T" }];
  expect(pickSpawn(points, new Set(["L0", "R0", "T"]), Math.random)).toBeNull();
  expect(pickSpawn(points, new Set(["L0", "R0"]), Math.random)?.id).toBe("T");
  const a = mulberry32(9);
  const b = mulberry32(9);
  const seq = (rng: () => number) =>
    Array.from({ length: 10 }, () => pickSpawn(points, new Set(), rng)?.id);
  expect(seq(a)).toEqual(seq(b));
});

test("the remix speed knob makes crocs arrive and swim faster (T11.2)", () => {
  expect(spawnSchedule(20_000, 1)).toEqual(spawnSchedule(20_000));
  const normal = spawnSchedule(20_000);
  const fast = spawnSchedule(20_000, 2);
  expect(fast.intervalMs).toBe(normal.intervalMs / 2);
  expect(fast.crocSpeed).toBe(normal.crocSpeed * 2);
  expect(fast.maxConcurrent).toBe(normal.maxConcurrent);
  expect(spawnSchedule(0, 0)).toEqual(spawnSchedule(0));
  expect(spawnSchedule(0, Number.NaN)).toEqual(spawnSchedule(0));
});

test("remix lives are a whole number from 1 to 9", () => {
  expect(livesFor(3)).toBe(MAX_LIVES);
  expect(livesFor(5)).toBe(5);
  expect(livesFor(0)).toBe(1);
  expect(livesFor(2.6)).toBe(3);
  expect(livesFor(99)).toBe(9);
  expect(livesFor(Number.NaN)).toBe(MAX_LIVES);
});
