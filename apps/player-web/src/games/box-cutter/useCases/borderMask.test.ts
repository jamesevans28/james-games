import { test, expect } from "vitest";
import { computeBorderMask, countForwardBorderOptions, findNearestBorderCell } from "./borderMask";
import { idx, type Grid } from "./grid";

const grid: Grid = { originX: 0, originY: 0, cols: 5, rows: 5, cellSize: 10 };
const cells = () => new Uint8Array(grid.cols * grid.rows);
const at = (mask: Uint8Array, c: number, r: number) => mask[idx(grid, c, r)];

test("an empty board's border is its outer ring", () => {
  const border = computeBorderMask(grid, cells());
  expect(at(border, 0, 0)).toBe(1);
  expect(at(border, 4, 2)).toBe(1);
  expect(at(border, 2, 4)).toBe(1);
  expect(at(border, 2, 2)).toBe(0);
  expect(border.reduce((n, v) => n + v, 0)).toBe(16);
});

test("cells next to a filled area join the border; filled cells don't", () => {
  const filled = cells();
  filled[idx(grid, 2, 2)] = 1;
  const border = computeBorderMask(grid, filled);
  expect(at(border, 2, 2)).toBe(0);
  expect(at(border, 1, 2)).toBe(1);
  expect(at(border, 3, 2)).toBe(1);
  expect(at(border, 2, 1)).toBe(1);
  expect(at(border, 2, 3)).toBe(1);
  expect(at(border, 1, 1)).toBe(0); // diagonal only
});

test("a straight stretch of border has exactly one way forward", () => {
  const border = computeBorderMask(grid, cells());
  const filled = cells();
  expect(countForwardBorderOptions(grid, filled, border, { c: 1, r: 0 }, { c: 2, r: 0 })).toBe(1);
});

test("a corner of the board still has one way forward", () => {
  const border = computeBorderMask(grid, cells());
  expect(countForwardBorderOptions(grid, cells(), border, { c: 3, r: 0 }, { c: 4, r: 0 })).toBe(1);
});

test("a junction has more than one way forward", () => {
  const filled = cells();
  filled[idx(grid, 2, 1)] = 1; // a notch in from the top edge
  filled[idx(grid, 2, 2)] = 1;
  const border = computeBorderMask(grid, filled);
  // At (1,1) coming from (1,0): (0,1) and (1,2) are both border cells.
  expect(countForwardBorderOptions(grid, filled, border, { c: 1, r: 0 }, { c: 1, r: 1 })).toBe(2);
});

test("filled neighbours are never a way forward", () => {
  const filled = cells();
  filled[idx(grid, 3, 0)] = 1;
  const border = computeBorderMask(grid, filled);
  // (3,0) is filled and (2,1) is open play area: a dead end, so the player stops.
  expect(countForwardBorderOptions(grid, filled, border, { c: 1, r: 0 }, { c: 2, r: 0 })).toBe(0);
});

test("findNearestBorderCell returns the start when it is already on the border", () => {
  const border = computeBorderMask(grid, cells());
  expect(findNearestBorderCell(grid, cells(), border, { c: 0, r: 3 })).toEqual({ c: 0, r: 3 });
});

test("findNearestBorderCell walks out of a filled area to the closest open border", () => {
  const filled = cells();
  for (let c = 0; c < 5; c++) {
    filled[idx(grid, c, 0)] = 1;
    filled[idx(grid, c, 1)] = 1;
  }
  const border = computeBorderMask(grid, filled);
  expect(findNearestBorderCell(grid, filled, border, { c: 2, r: 0 })).toEqual({ c: 2, r: 2 });
});

test("findNearestBorderCell gives null when there is no open border", () => {
  const filled = new Uint8Array(grid.cols * grid.rows).fill(1);
  const border = computeBorderMask(grid, filled);
  expect(findNearestBorderCell(grid, filled, border, { c: 2, r: 2 })).toBeNull();
  expect(findNearestBorderCell(grid, filled, border, { c: 9, r: 9 })).toBeNull();
});
