/** Blocker pieces: shapes, rotation and the random tray draw. Pure, no Phaser. */

/** A cell offset inside a piece: `x` is the column, `y` the row. */
export type Offset = { readonly x: number; readonly y: number };

export type Shape = {
  readonly id: string;
  /** Tint for the block sprites (0xRRGGBB). */
  readonly color: number;
  readonly cells: readonly Offset[];
};

export type Piece = {
  readonly shape: Shape;
  /** Quarter turns, 0 to 3. */
  readonly rotation: number;
  /** The rotated cells, normalised so the smallest x and y are 0. */
  readonly cells: readonly Offset[];
  readonly width: number;
  readonly height: number;
};

const shape = (id: string, color: number, coords: readonly (readonly [number, number])[]) => ({
  id,
  color,
  cells: coords.map(([x, y]) => ({ x, y })),
});

export const SHAPES: readonly Shape[] = [
  shape("single", 0xef5350, [[0, 0]]),
  shape("domino", 0xff6f61, [
    [0, 0],
    [1, 0],
  ]),
  shape("line-three", 0x8e24aa, [
    [0, 0],
    [1, 0],
    [2, 0],
  ]),
  shape("l-shape", 0x5c6bc0, [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ]),
  shape("corner-three", 0xffa726, [
    [0, 0],
    [0, 1],
    [1, 1],
  ]),
  shape("t-three", 0x42a5f5, [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ]),
  shape("square-four", 0xab47bc, [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]),
  shape("zig-five", 0x66bb6a, [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
    [2, 2],
  ]),
  shape("tee-five", 0xff7043, [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
    [1, 2],
  ]),
];

function normalise(cells: readonly Offset[]): Offset[] {
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  return cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
}

/** `shape` turned `rotation` quarter turns. */
export function makePiece(s: Shape, rotation = 0): Piece {
  const turns = ((rotation % 4) + 4) % 4;
  let cells = normalise(s.cells);
  for (let i = 0; i < turns; i++) {
    cells = normalise(cells.map(({ x, y }) => ({ x: y, y: -x })));
  }
  return {
    shape: s,
    rotation: turns,
    cells,
    width: Math.max(...cells.map((c) => c.x)) + 1,
    height: Math.max(...cells.map((c) => c.y)) + 1,
  };
}

/** The same piece one quarter turn on. */
export const rotate = (piece: Piece): Piece => makePiece(piece.shape, piece.rotation + 1);

const cellKey = (cells: readonly Offset[]) =>
  cells
    .map((c) => `${c.x}:${c.y}`)
    .sort()
    .join("|");

/** Every distinct orientation of a piece (a square has one, a line two). */
export function rotations(piece: Piece): Piece[] {
  const seen = new Set<string>();
  const out: Piece[] = [];
  for (let r = 0; r < 4; r++) {
    const p = makePiece(piece.shape, piece.rotation + r);
    const key = cellKey(p.cells);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** A random unrotated piece. */
export function randomPiece(rng: () => number, shapes: readonly Shape[] = SHAPES): Piece {
  const i = Math.min(shapes.length - 1, Math.floor(rng() * shapes.length));
  const s = shapes[i];
  if (!s) throw new Error("randomPiece needs at least one shape");
  return makePiece(s);
}
