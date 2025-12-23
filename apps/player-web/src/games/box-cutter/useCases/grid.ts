import type { Bounds } from "../entities/GameState";

export type Grid = {
  originX: number;
  originY: number;
  cols: number;
  rows: number;
  cellSize: number;
};

export type Cell = { c: number; r: number };

export function createGrid(bounds: Bounds, cellSize: number): Grid {
  const cols = Math.max(1, Math.floor(bounds.width / cellSize));
  const rows = Math.max(1, Math.floor(bounds.height / cellSize));

  return {
    originX: bounds.x,
    originY: bounds.y,
    cols,
    rows,
    cellSize,
  };
}

export function idx(grid: Grid, c: number, r: number): number {
  return r * grid.cols + c;
}

export function clampCell(grid: Grid, c: number, r: number): Cell {
  return {
    c: Math.max(0, Math.min(grid.cols - 1, c)),
    r: Math.max(0, Math.min(grid.rows - 1, r)),
  };
}

export function worldToCell(grid: Grid, x: number, y: number): Cell {
  const c = Math.floor((x - grid.originX) / grid.cellSize);
  const r = Math.floor((y - grid.originY) / grid.cellSize);
  return clampCell(grid, c, r);
}

export function cellToWorldCenter(grid: Grid, c: number, r: number): { x: number; y: number } {
  return {
    x: grid.originX + (c + 0.5) * grid.cellSize,
    y: grid.originY + (r + 0.5) * grid.cellSize,
  };
}

export function inBounds(grid: Grid, c: number, r: number): boolean {
  return c >= 0 && c < grid.cols && r >= 0 && r < grid.rows;
}
