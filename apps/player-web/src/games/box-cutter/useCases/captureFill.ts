import type { Cell, Grid } from "./grid";
import { idx, inBounds } from "./grid";

export type CaptureResult = {
  newlyFilledCount: number;
  wallFilledCount: number;
};

export function applyCapture(
  grid: Grid,
  filled: Uint8Array,
  wall: Uint8Array,
  enemyCell: Cell
): CaptureResult {
  const reachable = new Uint8Array(filled.length);

  const startIdx = idx(grid, enemyCell.c, enemyCell.r);
  const isStartBlocked = filled[startIdx] === 1 || wall[startIdx] === 1;

  // If enemy somehow is inside blocked space, don't capture anything beyond the wall.
  if (!isStartBlocked) {
    const qC = new Int16Array(filled.length);
    const qR = new Int16Array(filled.length);
    let qh = 0;
    let qt = 0;

    qC[qt] = enemyCell.c;
    qR[qt] = enemyCell.r;
    qt++;

    reachable[startIdx] = 1;

    while (qh < qt) {
      const c = qC[qh];
      const r = qR[qh];
      qh++;

      const dirs = [
        { dc: 1, dr: 0 },
        { dc: -1, dr: 0 },
        { dc: 0, dr: 1 },
        { dc: 0, dr: -1 },
      ];

      for (const { dc, dr } of dirs) {
        const nc = c + dc;
        const nr = r + dr;
        if (!inBounds(grid, nc, nr)) continue;
        const ni = idx(grid, nc, nr);
        if (reachable[ni]) continue;
        if (filled[ni] || wall[ni]) continue;
        reachable[ni] = 1;
        qC[qt] = nc;
        qR[qt] = nr;
        qt++;
      }
    }
  }

  let newlyFilledCount = 0;
  let wallFilledCount = 0;

  for (let i = 0; i < filled.length; i++) {
    if (wall[i] && !filled[i]) {
      filled[i] = 1;
      wallFilledCount++;
      continue;
    }

    if (filled[i]) continue;
    if (wall[i]) continue;

    // Any empty cell not reachable from the enemy is captured
    if (!reachable[i]) {
      filled[i] = 1;
      newlyFilledCount++;
    }
  }

  // Clear wall after capture
  wall.fill(0);

  return { newlyFilledCount, wallFilledCount };
}
