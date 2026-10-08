import type { Bounds, Direction } from "../entities/GameState";

export type Grid = {
  originX: number;
  originY: number;
  cols: number;
  rows: number;
  cellSize: number;
};

export type Cell = { c: number; r: number };

/** The four grid neighbours, in a fixed order. */
export const NEIGHBOURS: readonly { dc: number; dr: number }[] = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
];

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

export function directionDelta(dir: Direction): { dc: number; dr: number } {
  switch (dir) {
    case "up":
      return { dc: 0, dr: -1 };
    case "down":
      return { dc: 0, dr: 1 };
    case "left":
      return { dc: -1, dr: 0 };
    case "right":
      return { dc: 1, dr: 0 };
  }
}

/** How many cells of a 0/1 mask are set. */
export function countSet(mask: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) count++;
  return count;
}
