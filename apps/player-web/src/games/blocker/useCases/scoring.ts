/** Blocker scoring. Pure, no Phaser. */
import type { PowerType } from "./board";
import type { Piece } from "./pieces";

/** One point for every cell placed. */
export const placementPoints = (piece: Piece): number => piece.cells.length;

/** The combo multiplier for clearing `lines` rows and columns in one move. */
export function comboMultiplier(lines: number): number {
  if (lines >= 3) return 2.5;
  if (lines === 2) return 1.8;
  if (lines === 1) return 1.3;
  return 1;
}

/** Ten points a cleared cell, times the combo multiplier. Nothing without a line. */
export function lineClearPoints(cellsCleared: number, lines: number): number {
  if (lines <= 0 || cellsCleared <= 0) return 0;
  return Math.round(cellsCleared * 10 * comboMultiplier(lines));
}

/** The power cell a move earns: two lines at once make a cross, three or more a blast. */
export function powerCellFor(linesCleared: number): PowerType | null {
  if (linesCleared >= 3) return "blast";
  if (linesCleared === 2) return "cross";
  return null;
}
