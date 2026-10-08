import { test, expect } from "vitest";
import { applyCapture } from "./captureFill";
import { idx, type Grid } from "./grid";

const grid: Grid = { originX: 0, originY: 0, cols: 5, rows: 5, cellSize: 10 };
const cells = () => new Uint8Array(grid.cols * grid.rows);
const column = (arr: Uint8Array, c: number) => {
  for (let r = 0; r < grid.rows; r++) arr[idx(grid, c, r)] = 1;
};
const count = (arr: Uint8Array) => arr.reduce((n, v) => n + v, 0);

test("captures the side the enemy can't reach and fills the wall", () => {
  const filled = cells();
  const wall = cells();
  column(wall, 2);
  const result = applyCapture(grid, filled, wall, { c: 0, r: 0 });
  expect(result).toEqual({ newlyFilledCount: 10, wallFilledCount: 5 });
  expect(filled[idx(grid, 4, 4)]).toBe(1); // captured side
  expect(filled[idx(grid, 0, 4)]).toBe(0); // enemy side stays open
  expect(count(wall)).toBe(0); // wall is cleared afterwards
});

test("captures the other side when the enemy is on the right", () => {
  const filled = cells();
  const wall = cells();
  column(wall, 2);
  const result = applyCapture(grid, filled, wall, { c: 4, r: 2 });
  expect(result.newlyFilledCount).toBe(10);
  expect(filled[idx(grid, 0, 0)]).toBe(1);
  expect(filled[idx(grid, 4, 2)]).toBe(0);
});

test("already-filled cells act as walls and are not recounted", () => {
  const filled = cells();
  const wall = cells();
  column(filled, 1);
  column(wall, 3);
  const result = applyCapture(grid, filled, wall, { c: 2, r: 2 });
  // Enemy is boxed into column 2; columns 0 and 4 are captured.
  expect(result).toEqual({ newlyFilledCount: 10, wallFilledCount: 5 });
  expect(filled[idx(grid, 2, 2)]).toBe(0);
});

test("an enemy inside blocked space captures nothing beyond the wall", () => {
  const filled = cells();
  const wall = cells();
  column(wall, 2);
  const result = applyCapture(grid, filled, wall, { c: 2, r: 0 });
  expect(result.wallFilledCount).toBe(5);
  expect(result.newlyFilledCount).toBe(20);
});
