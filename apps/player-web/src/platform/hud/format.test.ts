import { test, expect } from "vitest";
import { formatClock, formatScore, hexToNumber } from "./format";

test("clock", () => {
  expect(formatClock(65_000)).toBe("1:05");
  expect(formatClock(59_001)).toBe("1:00");
  expect(formatClock(1)).toBe("0:01");
  expect(formatClock(0)).toBe("0:00");
  expect(formatClock(-500)).toBe("0:00");
});

test("score", () => {
  expect(formatScore(87682)).toBe("87,682");
  expect(formatScore(-3)).toBe("0");
  expect(formatScore(9.9)).toBe("9");
});

test("hex colours", () => {
  expect(hexToNumber("#FF5A4E")).toBe(0xff5a4e);
  expect(hexToNumber("2B2118")).toBe(0x2b2118);
});
