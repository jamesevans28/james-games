import { test, expect } from "vitest";
import {
  anyFits,
  clearLines,
  emptyBoard,
  fits,
  fitsAnywhere,
  fullLines,
  GRID_SIZE,
  linesCompletedBy,
  pickPowerCell,
  place,
  powerArea,
  withPower,
  type Board,
  type BoardCell,
} from "./board";
import { makePiece, SHAPES, type Shape } from "./pieces";
import { mulberry32 } from "../../../platform/rng";

const byId = (id: string): Shape => {
  const s = SHAPES.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};
const single = makePiece(byId("single"));
const domino = makePiece(byId("domino"));
const square = makePiece(byId("square-four"));
const tee = makePiece(byId("tee-five"));

/** "#" filled, "." empty, "x" cross power, "b" blast power. */
function board(rows: string[]): Board {
  return rows.map((r) =>
    [...r].map((ch): BoardCell | null => {
      if (ch === ".") return null;
      if (ch === "x") return { color: 1, power: "cross" };
      if (ch === "b") return { color: 1, power: "blast" };
      return { color: 1 };
    }),
  );
}
const show = (b: Board) => b.map((r) => r.map((c) => (c ? "#" : ".")).join(""));

const FULL_ROW = "########";
const EMPTY_ROW = "........";

test("an empty board is 8×8 of nothing", () => {
  const b = emptyBoard();
  expect(b).toHaveLength(GRID_SIZE);
  expect(b.every((r) => r.length === GRID_SIZE && r.every((c) => c === null))).toBe(true);
  expect(emptyBoard(3)).toHaveLength(3);
});

test("fits on empty squares inside the board only", () => {
  const b = emptyBoard();
  expect(fits(b, square, { row: 0, col: 0 })).toBe(true);
  expect(fits(b, square, { row: 6, col: 6 })).toBe(true);
  expect(fits(b, square, { row: 7, col: 6 })).toBe(false); // off the bottom
  expect(fits(b, square, { row: 6, col: 7 })).toBe(false); // off the right
  expect(fits(b, square, { row: -1, col: 0 })).toBe(false);
  expect(fits(b, square, { row: 0, col: -1 })).toBe(false);
  const blocked = place(b, single, { row: 1, col: 1 });
  expect(fits(blocked, square, { row: 0, col: 0 })).toBe(false);
  expect(fits(blocked, square, { row: 0, col: 2 })).toBe(true);
});

test("place returns a new board and leaves the old one alone", () => {
  const b = emptyBoard();
  const next = place(b, tee, { row: 2, col: 3 });
  expect(show(b).join("")).toBe(EMPTY_ROW.repeat(8));
  expect(show(next).slice(2, 5)).toEqual(["...###..", "....#...", "....#..."]);
  expect(next[2]?.[3]).toEqual({ color: byId("tee-five").color });
});

test("place refuses a piece that doesn't fit", () => {
  const b = place(emptyBoard(), single, { row: 0, col: 0 });
  expect(() => place(b, single, { row: 0, col: 0 })).toThrow(RangeError);
  expect(() => place(b, square, { row: 7, col: 7 })).toThrow(RangeError);
});

test("full lines finds rows and columns", () => {
  const b = board([
    FULL_ROW,
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#......#",
  ]);
  expect(fullLines(b)).toEqual({ rows: [0], cols: [0] });
  expect(fullLines(emptyBoard())).toEqual({ rows: [], cols: [] });
});

test("clearing one row", () => {
  const b = board([EMPTY_ROW, FULL_ROW, "#.......", ...Array<string>(5).fill(EMPTY_ROW)]);
  const r = clearLines(b);
  expect(r.rows).toEqual([1]);
  expect(r.cols).toEqual([]);
  expect(r.lines).toBe(1);
  expect(r.cleared).toHaveLength(8);
  expect(r.triggered).toEqual([]);
  expect(show(r.board).slice(0, 3)).toEqual([EMPTY_ROW, EMPTY_ROW, "#......."]);
  // The input is untouched.
  expect(show(b)[1]).toBe(FULL_ROW);
});

test("a row and a column share their corner cell once", () => {
  const b = board([
    FULL_ROW,
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
  ]);
  const r = clearLines(b);
  expect(r.lines).toBe(2);
  expect(r.cleared).toHaveLength(15);
  expect(show(r.board).every((row) => row === EMPTY_ROW)).toBe(true);
});

test("nothing to clear leaves the board as it was", () => {
  const b = board(["#.......", ...Array<string>(7).fill(EMPTY_ROW)]);
  const r = clearLines(b);
  expect(r.lines).toBe(0);
  expect(r.cleared).toEqual([]);
  expect(show(r.board)).toEqual(show(b));
});

test("a cross in a cleared row also clears its column", () => {
  const b = board([
    EMPTY_ROW,
    "...#....",
    "...#....",
    "###x####",
    "...#....",
    "#.......",
    EMPTY_ROW,
    EMPTY_ROW,
  ]);
  const r = clearLines(b);
  expect(r.rows).toEqual([3]);
  expect(r.triggered).toEqual([{ row: 3, col: 3, type: "cross" }]);
  expect(r.cleared).toHaveLength(11);
  expect(show(r.board)[5]).toBe("#.......");
  expect(show(r.board).filter((row) => row !== EMPTY_ROW)).toEqual(["#......."]);
});

test("a blast in a cleared row clears the 5×5 around it, clipped to the board", () => {
  const b = board([
    "b#######",
    "###.....",
    "###.....",
    "###.....",
    EMPTY_ROW,
    EMPTY_ROW,
    EMPTY_ROW,
    EMPTY_ROW,
  ]);
  const r = clearLines(b);
  expect(r.triggered).toEqual([{ row: 0, col: 0, type: "blast" }]);
  // Row 0 (8) + the 3×3 below-left of the blast (rows 1-2, cols 0-2 = 6); row 3 is out of reach.
  expect(r.cleared).toHaveLength(14);
  expect(show(r.board).slice(0, 4)).toEqual([EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, "###....."]);
});

test("a power at a crossing fires once, and powers only caught in a blast don't fire", () => {
  const b = board([
    "x#######",
    "#.x.....",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
    "#.......",
  ]);
  const r = clearLines(b);
  expect(r.triggered).toEqual([{ row: 0, col: 0, type: "cross" }]);
  // The cross at (1,2) is not in a cleared line, and the first cross only reaches row 0 / col 0.
  expect(show(r.board)[1]).toBe("..#.....");
});

test("power area: a cross is one row and one column", () => {
  const cross = powerArea(8, { row: 2, col: 5, type: "cross" });
  expect(cross).toHaveLength(15);
  expect(new Set(cross.map((p) => `${p.row}:${p.col}`)).size).toBe(15);
  expect(cross.every((p) => p.row === 2 || p.col === 5)).toBe(true);
});

test("power area: a blast is 5×5, clipped at the corners", () => {
  expect(powerArea(8, { row: 4, col: 4, type: "blast" })).toHaveLength(25);
  expect(powerArea(8, { row: 0, col: 0, type: "blast" })).toHaveLength(9);
  expect(powerArea(8, { row: 7, col: 3, type: "blast" })).toHaveLength(15);
});

test("lines a placement would complete, for the preview", () => {
  const b = board(["#######.", ...Array<string>(7).fill(EMPTY_ROW)]);
  expect(linesCompletedBy(b, single, { row: 0, col: 7 })).toEqual({ rows: [0], cols: [] });
  expect(linesCompletedBy(b, single, { row: 1, col: 7 })).toEqual({ rows: [], cols: [] });
  expect(linesCompletedBy(b, domino, { row: 0, col: 7 })).toEqual({ rows: [], cols: [] }); // off the edge
});

test("fitsAnywhere and anyFits", () => {
  // Every other cell filled: only singles fit.
  const checker = board(Array.from({ length: 8 }, (_, r) => (r % 2 ? "#.#.#.#." : ".#.#.#.#")));
  expect(fitsAnywhere(checker, single)).toBe(true);
  expect(fitsAnywhere(checker, domino)).toBe(false);
  expect(anyFits(checker, [domino, square, null])).toBe(false);
  expect(anyFits(checker, [domino, null, single])).toBe(true);
  expect(anyFits(checker, [null, null, null])).toBe(false);
  expect(anyFits(emptyBoard(), [tee])).toBe(true);
});

test("anyFits counts rotations: a vertical gap takes a flat domino", () => {
  // Only free cells: (0,0) and (1,0), a vertical pair.
  const b = board([".#######", ".#######", ...Array<string>(6).fill(FULL_ROW)]);
  expect(fitsAnywhere(b, domino)).toBe(false); // flat as dealt
  expect(anyFits(b, [domino])).toBe(true); // but the rotate button stands it up
  expect(anyFits(b, [square])).toBe(false);
});

test("the board fills up: anyFits turns false once nothing goes", () => {
  let b = emptyBoard();
  let moves = 0;
  // Keep dropping squares at the first fitting spot, never clearing.
  for (;;) {
    let placed = false;
    for (let row = 0; row < 8 && !placed; row++) {
      for (let col = 0; col < 8 && !placed; col++) {
        if (fits(b, square, { row, col })) {
          b = place(b, square, { row, col });
          placed = true;
          moves++;
        }
      }
    }
    if (!placed) break;
  }
  expect(moves).toBe(16);
  expect(anyFits(b, [square, single])).toBe(false);
});

test("power cells go on filled cells, preferring plain ones", () => {
  expect(pickPowerCell(emptyBoard(), Math.random)).toBeNull();
  const b = board(["x#......", ...Array<string>(7).fill(EMPTY_ROW)]);
  expect(pickPowerCell(b, () => 0)).toEqual({ row: 0, col: 1 });
  const allPowered = board(["xb......", ...Array<string>(7).fill(EMPTY_ROW)]);
  expect(pickPowerCell(allPowered, () => 0.99)).toEqual({ row: 0, col: 1 });
  const rngA = mulberry32(3);
  const rngB = mulberry32(3);
  const full = board(Array<string>(8).fill(FULL_ROW));
  expect(pickPowerCell(full, rngA)).toEqual(pickPowerCell(full, rngB));
});

test("withPower marks a filled cell and ignores an empty one", () => {
  const b = board(["#.......", ...Array<string>(7).fill(EMPTY_ROW)]);
  const powered = withPower(b, { row: 0, col: 0 }, "blast");
  expect(powered[0]?.[0]).toEqual({ color: 1, power: "blast" });
  expect(b[0]?.[0]).toEqual({ color: 1 });
  expect(withPower(b, { row: 0, col: 1 }, "cross")).toBe(b);
});
