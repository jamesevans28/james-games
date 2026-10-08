import { test, expect } from "vitest";
import {
  cellToWorldCenter,
  clampCell,
  countSet,
  createGrid,
  directionDelta,
  idx,
  inBounds,
  worldToCell,
} from "./grid";

const grid = createGrid({ x: 30, y: 200, width: 100, height: 61 }, 10);

test("createGrid fits whole cells inside the bounds", () => {
  expect(grid).toEqual({ originX: 30, originY: 200, cols: 10, rows: 6, cellSize: 10 });
});

test("createGrid always has at least one cell", () => {
  const tiny = createGrid({ x: 0, y: 0, width: 2, height: 2 }, 10);
  expect(tiny.cols).toBe(1);
  expect(tiny.rows).toBe(1);
});

test("idx is row-major", () => {
  expect(idx(grid, 0, 0)).toBe(0);
  expect(idx(grid, 9, 0)).toBe(9);
  expect(idx(grid, 0, 1)).toBe(10);
  expect(idx(grid, 3, 5)).toBe(53);
});

test("clampCell keeps cells on the board", () => {
  expect(clampCell(grid, -4, 99)).toEqual({ c: 0, r: 5 });
  expect(clampCell(grid, 12, -1)).toEqual({ c: 9, r: 0 });
  expect(clampCell(grid, 4, 3)).toEqual({ c: 4, r: 3 });
});

test("worldToCell and cellToWorldCenter round-trip", () => {
  const centre = cellToWorldCenter(grid, 4, 2);
  expect(centre).toEqual({ x: 75, y: 225 });
  expect(worldToCell(grid, centre.x, centre.y)).toEqual({ c: 4, r: 2 });
  // Off the board clamps to the nearest edge cell.
  expect(worldToCell(grid, 0, 0)).toEqual({ c: 0, r: 0 });
  expect(worldToCell(grid, 1000, 1000)).toEqual({ c: 9, r: 5 });
});

test("inBounds", () => {
  expect(inBounds(grid, 0, 0)).toBe(true);
  expect(inBounds(grid, 9, 5)).toBe(true);
  expect(inBounds(grid, 10, 0)).toBe(false);
  expect(inBounds(grid, 0, 6)).toBe(false);
  expect(inBounds(grid, -1, 2)).toBe(false);
});

test("directionDelta", () => {
  expect(directionDelta("up")).toEqual({ dc: 0, dr: -1 });
  expect(directionDelta("down")).toEqual({ dc: 0, dr: 1 });
  expect(directionDelta("left")).toEqual({ dc: -1, dr: 0 });
  expect(directionDelta("right")).toEqual({ dc: 1, dr: 0 });
});

test("countSet counts the 1s", () => {
  expect(countSet(new Uint8Array([0, 1, 1, 0, 1]))).toBe(3);
  expect(countSet(new Uint8Array(4))).toBe(0);
});
