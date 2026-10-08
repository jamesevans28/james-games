import { test, expect } from "vitest";
import { rasterizePolyline } from "./rasterize";
import { idx, type Grid } from "./grid";

const grid: Grid = { originX: 0, originY: 0, cols: 6, rows: 6, cellSize: 10 };
const cells = () => new Uint8Array(grid.cols * grid.rows);
const count = (mask: Uint8Array) => mask.reduce((n, v) => n + v, 0);

test("a single point marks nothing", () => {
  const mask = cells();
  rasterizePolyline(grid, [{ c: 1, r: 1 }], mask);
  expect(count(mask)).toBe(0);
});

test("a straight line marks every cell between its ends", () => {
  const mask = cells();
  rasterizePolyline(
    grid,
    [
      { c: 1, r: 2 },
      { c: 4, r: 2 },
    ],
    mask,
  );
  expect(count(mask)).toBe(4);
  for (let c = 1; c <= 4; c++) expect(mask[idx(grid, c, 2)]).toBe(1);
});

test("an L-shaped path marks both legs without gaps", () => {
  const mask = cells();
  rasterizePolyline(
    grid,
    [
      { c: 0, r: 0 },
      { c: 0, r: 3 },
      { c: 3, r: 3 },
    ],
    mask,
  );
  expect(count(mask)).toBe(7); // the corner is shared
  expect(mask[idx(grid, 0, 3)]).toBe(1);
  expect(mask[idx(grid, 3, 3)]).toBe(1);
});

test("a diagonal is drawn and cells off the board are skipped", () => {
  const mask = cells();
  rasterizePolyline(
    grid,
    [
      { c: 4, r: 4 },
      { c: 7, r: 7 },
    ],
    mask,
  );
  expect(mask[idx(grid, 4, 4)]).toBe(1);
  expect(mask[idx(grid, 5, 5)]).toBe(1);
  expect(count(mask)).toBe(2);
});
