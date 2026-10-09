/**
 * Colour Sort rules. A tube is a stack of colour indices, bottom first; the last
 * entry is the top ball. A board is a list of tubes that all share one capacity.
 */
export type Tube = readonly number[];
export type Board = readonly Tube[];

/** Balls a tube holds. Every colour has exactly this many balls, so a full tube of one colour is done. */
export const CAPACITY = 4;

/** The colour on top of a tube, or null when it is empty. */
export function topColour(tube: Tube): number | null {
  return tube.length ? (tube[tube.length - 1] ?? null) : null;
}

/** How many balls of the top colour sit together at the top of a tube. */
export function topRun(tube: Tube): number {
  const top = topColour(tube);
  if (top === null) return 0;
  let n = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === top; i--) n++;
  return n;
}

/**
 * How many balls a pour from `from` to `to` would move: the whole top run, or as many
 * as fit. 0 when the pour isn't allowed (same tube, empty source, full target, or the
 * target's top colour doesn't match).
 */
export function pourCount(board: Board, from: number, to: number, capacity = CAPACITY): number {
  const src = board[from];
  const dst = board[to];
  if (!src || !dst || from === to) return 0;
  const colour = topColour(src);
  if (colour === null) return 0;
  const room = capacity - dst.length;
  if (room <= 0) return 0;
  const dstTop = topColour(dst);
  if (dstTop !== null && dstTop !== colour) return 0;
  return Math.min(topRun(src), room);
}

export function canPour(board: Board, from: number, to: number, capacity = CAPACITY): boolean {
  return pourCount(board, from, to, capacity) > 0;
}

/** The board after pouring `from` into `to` (unchanged when the pour isn't allowed). */
export function pour(board: Board, from: number, to: number, capacity = CAPACITY): Board {
  const n = pourCount(board, from, to, capacity);
  if (n === 0) return board;
  return board.map((tube, i) => {
    if (i === from) return tube.slice(0, tube.length - n);
    if (i === to) return [...tube, ...(board[from] ?? []).slice(-n)];
    return tube;
  });
}

/** A tube is done when it is full of one colour. */
export function isTubeDone(tube: Tube, capacity = CAPACITY): boolean {
  return tube.length === capacity && topRun(tube) === capacity;
}

/** The level is cleared when every tube is either empty or done. */
export function isSolved(board: Board, capacity = CAPACITY): boolean {
  return board.every((t) => t.length === 0 || isTubeDone(t, capacity));
}

export type TapResult =
  | { kind: "select"; selected: number }
  | { kind: "deselect" }
  | { kind: "pour"; from: number; to: number; count: number }
  | { kind: "nope"; selected: number | null };

/**
 * What a tap on tube `index` does, given the currently selected tube (or null):
 * - nothing selected: pick up a tube that has balls (not a finished one);
 * - tap the selected tube again: put the balls back down;
 * - tap another tube: pour if the colours match and there's room, else switch the
 *   selection to that tube when it has balls (kids change their minds), else "nope".
 */
export function tap(board: Board, selected: number | null, index: number): TapResult {
  const tube = board[index];
  if (!tube) return { kind: "nope", selected };
  if (selected === null) {
    return tube.length && !isTubeDone(tube)
      ? { kind: "select", selected: index }
      : { kind: "nope", selected: null };
  }
  if (selected === index) return { kind: "deselect" };
  const count = pourCount(board, selected, index);
  if (count > 0) return { kind: "pour", from: selected, to: index, count };
  if (tube.length && !isTubeDone(tube)) return { kind: "select", selected: index };
  return { kind: "nope", selected };
}
