/** Blocker screen geometry: the grid, the three-slot tray and hit-testing. Pure, no Phaser. */
import type { Pos } from "./board";
import type { Piece } from "./pieces";

export type Point = { readonly x: number; readonly y: number };

/** Where the board sits on screen, in design pixels. */
export type GridGeometry = {
  /** Left and top edge of cell (0, 0). */
  readonly x: number;
  readonly y: number;
  /** Cell size. */
  readonly cell: number;
  /** Cells per side. */
  readonly size: number;
};

export const TRAY_SLOTS = 3;

/** The x centre of each tray slot when `count` slots share `width`. */
export function slotCentres(width: number, count = TRAY_SLOTS): number[] {
  return Array.from({ length: count }, (_, i) => (width * (2 * i + 1)) / (2 * count));
}

/** Centres of a piece's cells when the piece is drawn centred on `centre` at `cellPx`. */
export function pieceCellCentres(piece: Piece, centre: Point, cellPx: number): Point[] {
  const w = piece.width * cellPx;
  const h = piece.height * cellPx;
  return piece.cells.map((c) => ({
    x: centre.x - w / 2 + (c.x + 0.5) * cellPx,
    y: centre.y - h / 2 + (c.y + 0.5) * cellPx,
  }));
}

export type TraySlot = { readonly piece: Piece | null; readonly centre: Point };

/**
 * Which tray piece is under the finger: the slot whose piece has a cell within
 * `slop` pixels of the point (nearest wins), or -1. Hit-testing the cells rather
 * than screen strips means the rotate button and the gaps never start a drag.
 */
export function hitTestTray(
  point: Point,
  slots: readonly TraySlot[],
  cellPx: number,
  slop: number,
): number {
  const reach = cellPx / 2 + slop;
  let best = -1;
  let bestDist = Infinity;
  slots.forEach((slot, i) => {
    if (!slot.piece) return;
    for (const c of pieceCellCentres(slot.piece, slot.centre, cellPx)) {
      const dx = Math.abs(point.x - c.x);
      const dy = Math.abs(point.y - c.y);
      if (dx > reach || dy > reach) continue;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
  });
  return best;
}

/**
 * The board position (top-left cell) for a full-size piece centred at `centre`,
 * rounded to the nearest cell, or null while it is more than a cell away from the
 * board. The position may still hang off the edge; `fits` rejects that.
 */
export function snapToGrid(piece: Piece, centre: Point, grid: GridGeometry): Pos | null {
  const w = piece.width * grid.cell;
  const h = piece.height * grid.cell;
  const left = centre.x - w / 2;
  const top = centre.y - h / 2;
  const span = grid.size * grid.cell;
  if (
    left + w < grid.x - grid.cell ||
    left > grid.x + span + grid.cell ||
    top + h < grid.y - grid.cell ||
    top > grid.y + span + grid.cell
  ) {
    return null;
  }
  return {
    row: Math.round((top - grid.y) / grid.cell),
    col: Math.round((left - grid.x) / grid.cell),
  };
}

/** Screen centre of a board cell. */
export const cellCentre = (pos: Pos, grid: GridGeometry): Point => ({
  x: grid.x + (pos.col + 0.5) * grid.cell,
  y: grid.y + (pos.row + 0.5) * grid.cell,
});

/** Screen centre of a piece placed at `pos` (the average of its cells), for score popups. */
export function placedCentre(piece: Piece, pos: Pos, grid: GridGeometry): Point {
  const n = piece.cells.length || 1;
  let x = 0;
  let y = 0;
  for (const c of piece.cells) {
    const p = cellCentre({ row: pos.row + c.y, col: pos.col + c.x }, grid);
    x += p.x;
    y += p.y;
  }
  return { x: x / n, y: y / n };
}
