import { test, expect } from "vitest";
import { mulberry32 } from "./rng";

const take = (next: () => number, n: number) => Array.from({ length: n }, next);

test("same seed, same sequence", () => {
  expect(take(mulberry32(42), 20)).toEqual(take(mulberry32(42), 20));
});

test("different seeds differ", () => {
  expect(take(mulberry32(1), 5)).not.toEqual(take(mulberry32(2), 5));
});

test("values stay in [0, 1) and spread out", () => {
  const values = take(mulberry32(7), 10_000);
  expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...values)).toBeLessThan(1);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  expect(mean).toBeGreaterThan(0.45);
  expect(mean).toBeLessThan(0.55);
});
