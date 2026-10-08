/** The Blocker board: placing pieces, clearing lines and power cells. Pure, no Phaser. */
import { rotations, type Piece } from "./pieces";

export const GRID_SIZE = 8;

/** A power cell fires when its line is cleared: a cross clears its row and column, a blast the 5×5 around it. */
export type PowerType = "cross" | "blast";

export type BoardCell = { readonly color: number; readonly power?: PowerType };
export type Board = readonly (readonly (BoardCell | null)[])[];
export type Pos = { readonly row: number; readonly col: number };
export type Lines = { readonly rows: number[]; readonly cols: number[] };

export function emptyBoard(size = GRID_SIZE): Board {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

const inside = (board: Board, row: number, col: number) =>
  row >= 0 && col >= 0 && row < board.length && col < board.length;

const at = (board: Board, row: number, col: number): BoardCell | null => board[row]?.[col] ?? null;

/** The board cells a piece would cover with its top-left at `pos`. */
export const cellsOf = (piece: Piece, pos: Pos): Pos[] =>
  piece.cells.map((c) => ({ row: pos.row + c.y, col: pos.col + c.x }));

/** True when every cell of the piece lands on the board on an empty square. */
export function fits(board: Board, piece: Piece, pos: Pos): boolean {
  return cellsOf(piece, pos).every(
    ({ row, col }) => inside(board, row, col) && at(board, row, col) === null,
  );
}

const copy = (board: Board): (BoardCell | null)[][] => board.map((r) => [...r]);

/** A new board with the piece placed. Throws if it doesn't fit: check `fits` first. */
export function place(board: Board, piece: Piece, pos: Pos): Board {
  if (!fits(board, piece, pos)) throw new RangeError("piece does not fit there");
  const next = copy(board);
  for (const { row, col } of cellsOf(piece, pos)) {
    const r = next[row];
    if (r) r[col] = { color: piece.shape.color };
  }
  return next;
}

/** Rows and columns with no gaps. */
export function fullLines(board: Board): Lines {
  const n = board.length;
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < n; i++) {
    if (board[i]?.every((c) => c !== null)) rows.push(i);
    if (board.every((r) => r[i] !== null)) cols.push(i);
  }
  return { rows, cols };
}

/** The lines a placement would complete (for the drag preview); none if it doesn't fit. */
export function linesCompletedBy(board: Board, piece: Piece, pos: Pos): Lines {
  if (!fits(board, piece, pos)) return { rows: [], cols: [] };
  return fullLines(place(board, piece, pos));
}

/** The cells a power clears, clipped to the board. */
export function powerArea(size: number, power: Pos & { type: PowerType }): Pos[] {
  const out: Pos[] = [];
  if (power.type === "cross") {
    for (let i = 0; i < size; i++) {
      out.push({ row: power.row, col: i });
      if (i !== power.row) out.push({ row: i, col: power.col });
    }
    return out;
  }
  for (let row = power.row - 2; row <= power.row + 2; row++) {
    for (let col = power.col - 2; col <= power.col + 2; col++) {
      if (row >= 0 && col >= 0 && row < size && col < size) out.push({ row, col });
    }
  }
  return out;
}

export type ClearResult = {
  readonly board: Board;
  readonly rows: number[];
  readonly cols: number[];
  /** Rows plus columns cleared. */
  readonly lines: number;
  /** Every filled cell removed, by lines or by powers. */
  readonly cleared: Pos[];
  /** Power cells inside the cleared lines, which fired. */
  readonly triggered: (Pos & { type: PowerType })[];
};

/**
 * Clears every full row and column. Power cells inside those lines fire and clear
 * their area too (a power caught only in another power's area doesn't fire).
 */
export function clearLines(board: Board): ClearResult {
  const { rows, cols } = fullLines(board);
  const n = board.length;
  const toClear = new Map<string, Pos>();
  const add = (p: Pos) => toClear.set(`${p.row}:${p.col}`, p);

  const lineCells: Pos[] = [];
  rows.forEach((row) => {
    for (let col = 0; col < n; col++) lineCells.push({ row, col });
  });
  cols.forEach((col) => {
    for (let row = 0; row < n; row++) lineCells.push({ row, col });
  });

  const triggered: (Pos & { type: PowerType })[] = [];
  const seenPower = new Set<string>();
  for (const p of lineCells) {
    add(p);
    const power = at(board, p.row, p.col)?.power;
    const key = `${p.row}:${p.col}`;
    if (power && !seenPower.has(key)) {
      seenPower.add(key);
      triggered.push({ ...p, type: power });
    }
  }
  triggered.forEach((power) => powerArea(n, power).forEach(add));

  const next = copy(board);
  const cleared: Pos[] = [];
  toClear.forEach((p) => {
    const r = next[p.row];
    if (r?.[p.col]) {
      r[p.col] = null;
      cleared.push(p);
    }
  });

  return { board: next, rows, cols, lines: rows.length + cols.length, cleared, triggered };
}

/** True if the piece fits somewhere on the board as it is. */
export function fitsAnywhere(board: Board, piece: Piece): boolean {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board.length; col++) {
      if (fits(board, piece, { row, col })) return true;
    }
  }
  return false;
}

/**
 * True while the player still has a move: some tray piece fits somewhere in some
 * rotation (the rotate button is free, so every rotation counts).
 */
export function anyFits(board: Board, pieces: readonly (Piece | null)[]): boolean {
  return pieces.some((p) => p !== null && rotations(p).some((r) => fitsAnywhere(board, r)));
}

/** A filled cell to turn into a power cell, preferring ones that aren't already powered. */
export function pickPowerCell(board: Board, rng: () => number): Pos | null {
  const plain: Pos[] = [];
  const powered: Pos[] = [];
  board.forEach((r, row) =>
    r.forEach((c, col) => {
      if (c) (c.power ? powered : plain).push({ row, col });
    }),
  );
  const pool = plain.length > 0 ? plain : powered;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] ?? null;
}

/** A new board with the cell at `pos` made a power cell (no-op on an empty cell). */
export function withPower(board: Board, pos: Pos, type: PowerType): Board {
  const cell = at(board, pos.row, pos.col);
  if (!cell) return board;
  const next = copy(board);
  const r = next[pos.row];
  if (r) r[pos.col] = { ...cell, power: type };
  return next;
}
