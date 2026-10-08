import type { Cell, Grid } from "./grid";
import { idx, inBounds, NEIGHBOURS } from "./grid";

/** Open cells the player can walk on: the outer edge, and anything touching a filled cell. */
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

      for (const { dc, dr } of NEIGHBOURS) {
        if (filled[idx(grid, c + dc, r + dr)]) {
          border[i] = 1;
          break;
        }
      }
    }
  }

  return border;
}

/**
 * Border cells the player could carry on to from `at`, not counting the cell it
 * came `from`. Following the border stops where this isn't exactly one.
 */
export function countForwardBorderOptions(
  grid: Grid,
  filled: Uint8Array,
  border: Uint8Array,
  from: Cell,
  at: Cell,
): number {
  let count = 0;
  for (const { dc, dr } of NEIGHBOURS) {
    const nc = at.c + dc;
    const nr = at.r + dr;
    if (!inBounds(grid, nc, nr)) continue;
    if (nc === from.c && nr === from.r) continue;
    const ni = idx(grid, nc, nr);
    if (filled[ni] === 1) continue;
    if (border[ni] === 1) count++;
  }
  return count;
}

/** The closest open border cell to `start` (breadth-first, through anything), or null. */
export function findNearestBorderCell(
  grid: Grid,
  filled: Uint8Array,
  border: Uint8Array,
  start: Cell,
): Cell | null {
  if (!inBounds(grid, start.c, start.r)) return null;
  const total = grid.cols * grid.rows;
  const visited = new Uint8Array(total);
  const qC = new Int16Array(total);
  const qR = new Int16Array(total);
  let qh = 0;
  let qt = 0;

  qC[qt] = start.c;
  qR[qt] = start.r;
  qt++;
  visited[idx(grid, start.c, start.r)] = 1;

  while (qh < qt) {
    // qh < qt, so both queues hold a value here.
    const c = qC[qh] ?? 0;
    const r = qR[qh] ?? 0;
    qh++;

    const i = idx(grid, c, r);
    if (filled[i] !== 1 && border[i] === 1) return { c, r };

    for (const { dc, dr } of NEIGHBOURS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!inBounds(grid, nc, nr)) continue;
      const ni = idx(grid, nc, nr);
      if (visited[ni]) continue;
      visited[ni] = 1;
      qC[qt] = nc;
      qR[qt] = nr;
      qt++;
    }
  }

  return null;
}
