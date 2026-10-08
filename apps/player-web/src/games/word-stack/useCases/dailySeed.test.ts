import { test, expect } from "vitest";
import { dailySeed } from "./dailySeed";

test("is YYYYMMDD in local time", () => {
  expect(dailySeed(new Date(2026, 9, 9))).toBe(20261009);
  expect(dailySeed(new Date(2027, 0, 1))).toBe(20270101);
  expect(dailySeed(new Date(2026, 11, 31))).toBe(20261231);
});

test("is the same all day and changes at local midnight", () => {
  const morning = new Date(2026, 9, 9, 0, 0, 1);
  const night = new Date(2026, 9, 9, 23, 59, 59);
  const tomorrow = new Date(2026, 9, 10, 0, 0, 0);
  expect(dailySeed(morning)).toBe(dailySeed(night));
  expect(dailySeed(tomorrow)).not.toBe(dailySeed(night));
});
