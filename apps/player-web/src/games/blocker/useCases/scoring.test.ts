import { test, expect } from "vitest";
import { comboMultiplier, lineClearPoints, placementPoints, powerCellFor } from "./scoring";
import { makePiece, SHAPES } from "./pieces";

test("placing scores one point per cell", () => {
  const points = SHAPES.map((s) => placementPoints(makePiece(s)));
  expect(points).toEqual([1, 2, 3, 4, 3, 4, 4, 5, 5]);
});

test("rotation doesn't change placement points", () => {
  for (const s of SHAPES) {
    expect(placementPoints(makePiece(s, 1))).toBe(placementPoints(makePiece(s)));
  }
});

test("combo multiplier grows with lines", () => {
  expect([0, 1, 2, 3, 6].map(comboMultiplier)).toEqual([1, 1.3, 1.8, 2.5, 2.5]);
});

test("line clears: ten a cell times the combo", () => {
  expect(lineClearPoints(8, 1)).toBe(104);
  expect(lineClearPoints(15, 2)).toBe(270);
  expect(lineClearPoints(22, 3)).toBe(550);
  expect(lineClearPoints(64, 6)).toBe(1600);
});

test("no line, no clear points", () => {
  expect(lineClearPoints(0, 0)).toBe(0);
  expect(lineClearPoints(8, 0)).toBe(0);
  expect(lineClearPoints(0, 1)).toBe(0);
});

test("power cells: two lines make a cross, three or more a blast", () => {
  expect(powerCellFor(0)).toBeNull();
  expect(powerCellFor(1)).toBeNull();
  expect(powerCellFor(2)).toBe("cross");
  expect(powerCellFor(3)).toBe("blast");
  expect(powerCellFor(5)).toBe("blast");
});
