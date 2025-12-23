import type { Grid } from "./grid";
import { idx, inBounds } from "./grid";

export function computeBorderMask(grid: Grid, filled: Uint8Array): Uint8Array {
  const border = new Uint8Array(filled.length);

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const i = idx(grid, c, r);
      if (filled[i]) continue; // filled cells are out of play

      const onOuterEdge = c === 0 || r === 0 || c === grid.cols - 1 || r === grid.rows - 1;
      if (onOuterEdge) {
        border[i] = 1;
        continue;
      }

      // If adjacent to a filled cell, it's a border cell
      const neighbors = [
        idx(grid, c - 1, r),
        idx(grid, c + 1, r),
        idx(grid, c, r - 1),
        idx(grid, c, r + 1),
      ];

      for (const ni of neighbors) {
        if (filled[ni]) {
          border[i] = 1;
          break;
        }
      }
    }
  }

  return border;
}

export function isBorderCell(grid: Grid, border: Uint8Array, c: number, r: number): boolean {
  if (!inBounds(grid, c, r)) return false;
  return border[idx(grid, c, r)] === 1;
}
