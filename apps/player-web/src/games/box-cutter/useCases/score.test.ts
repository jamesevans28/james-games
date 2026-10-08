import { test, expect } from "vitest";
import { pointsForCapture } from "./score";
import { DEFAULT_CONFIG } from "../entities/GameState";

test("a 10% capture with the default config", () => {
  expect(pointsForCapture(10, DEFAULT_CONFIG)).toBe(115);
});

test("nothing captured scores nothing", () => {
  expect(pointsForCapture(0, DEFAULT_CONFIG)).toBe(0);
});

test("one big capture beats two half-size ones", () => {
  const one = pointsForCapture(40, DEFAULT_CONFIG);
  const two = 2 * pointsForCapture(20, DEFAULT_CONFIG);
  expect(one).toBeGreaterThan(two);
});

test("points always grow with area", () => {
  let last = -1;
  for (let pct = 0; pct <= 100; pct += 5) {
    const p = pointsForCapture(pct, DEFAULT_CONFIG);
    expect(p).toBeGreaterThanOrEqual(last);
    last = p;
  }
});
