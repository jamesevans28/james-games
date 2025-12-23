import type { Cell, Grid } from "./grid";
import { idx, inBounds } from "./grid";

function rasterizeLine(grid: Grid, a: Cell, b: Cell, mask: Uint8Array) {
  // Bresenham on grid cells
  let x0 = a.c;
  let y0 = a.r;
  const x1 = b.c;
  const y1 = b.r;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  // Safety bound to avoid infinite loops
  const maxSteps = grid.cols * grid.rows + 10;
  let steps = 0;

  while (true) {
    if (inBounds(grid, x0, y0)) {
      mask[idx(grid, x0, y0)] = 1;
    }

    if (x0 === x1 && y0 === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }

    steps++;
    if (steps > maxSteps) break;
  }
}

export function rasterizePolyline(grid: Grid, cells: Cell[], mask: Uint8Array) {
  if (cells.length < 2) return;
  for (let i = 0; i < cells.length - 1; i++) {
    rasterizeLine(grid, cells[i], cells[i + 1], mask);
  }
}
