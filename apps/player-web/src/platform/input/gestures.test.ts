import { test, expect } from "vitest";
import { classifySwipe, isTap, OPPOSITE, sideOf, zoneIndex } from "./gestures";

test("swipes pick the dominant axis", () => {
  expect(classifySwipe(80, 10, 120)).toBe("right");
  expect(classifySwipe(-80, 30, 120)).toBe("left");
  expect(classifySwipe(5, 60, 120)).toBe("down");
  expect(classifySwipe(20, -60, 120)).toBe("up");
});

test("short moves and slow drags are not swipes", () => {
  expect(classifySwipe(10, 5, 100)).toBeNull();
  expect(classifySwipe(200, 0, 900)).toBeNull();
  expect(classifySwipe(40, 0, 100, { threshold: 50 })).toBeNull();
});

test("zones", () => {
  expect(zoneIndex(0, 540, 3)).toBe(0);
  expect(zoneIndex(270, 540, 3)).toBe(1);
  expect(zoneIndex(539, 540, 3)).toBe(2);
  expect(zoneIndex(9999, 540, 3)).toBe(2);
  expect(zoneIndex(-5, 540, 3)).toBe(0);
  expect(sideOf(100, 540)).toBe(-1);
  expect(sideOf(400, 540)).toBe(1);
});

test("taps and opposites", () => {
  expect(isTap(120)).toBe(true);
  expect(isTap(400)).toBe(false);
  expect(OPPOSITE.left).toBe("right");
});
