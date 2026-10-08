import { test, expect } from "vitest";
import { makePiece, randomPiece, rotate, rotations, SHAPES, type Shape } from "./pieces";
import { mulberry32 } from "../../../platform/rng";

const byId = (id: string): Shape => {
  const s = SHAPES.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};

const sorted = (cells: readonly { x: number; y: number }[]) =>
  cells.map((c) => `${c.x}:${c.y}`).sort();

test("every shape is normalised and has a size", () => {
  for (const s of SHAPES) {
    const p = makePiece(s);
    expect(Math.min(...p.cells.map((c) => c.x))).toBe(0);
    expect(Math.min(...p.cells.map((c) => c.y))).toBe(0);
    expect(p.width).toBeGreaterThan(0);
    expect(p.height).toBeGreaterThan(0);
    expect(p.width).toBeLessThanOrEqual(3);
    expect(p.height).toBeLessThanOrEqual(3);
  }
});

test("rotating a domino swaps width and height", () => {
  const d = makePiece(byId("domino"));
  expect([d.width, d.height]).toEqual([2, 1]);
  const r = rotate(d);
  expect(r.rotation).toBe(1);
  expect([r.width, r.height]).toEqual([1, 2]);
  expect(sorted(r.cells)).toEqual(["0:0", "0:1"]);
});

test("four turns come back to the start", () => {
  for (const s of SHAPES) {
    const p = makePiece(s);
    const back = rotate(rotate(rotate(rotate(p))));
    expect(back.rotation).toBe(0);
    expect(sorted(back.cells)).toEqual(sorted(p.cells));
  }
});

test("rotation wraps and accepts negative turns", () => {
  const l = byId("l-shape");
  expect(makePiece(l, 5).rotation).toBe(1);
  expect(sorted(makePiece(l, -1).cells)).toEqual(sorted(makePiece(l, 3).cells));
});

test("the L takes a quarter turn (anticlockwise on screen)", () => {
  // ###      ##
  // ..#  ->  #.
  //          #.
  const r = rotate(makePiece(byId("l-shape")));
  expect([r.width, r.height]).toEqual([2, 3]);
  expect(sorted(r.cells)).toEqual(["0:0", "0:1", "0:2", "1:0"]);
});

test("rotations lists distinct orientations only", () => {
  expect(rotations(makePiece(byId("single")))).toHaveLength(1);
  expect(rotations(makePiece(byId("square-four")))).toHaveLength(1);
  expect(rotations(makePiece(byId("domino")))).toHaveLength(2);
  expect(rotations(makePiece(byId("line-three")))).toHaveLength(2);
  expect(rotations(makePiece(byId("l-shape")))).toHaveLength(4);
  expect(rotations(makePiece(byId("tee-five")))).toHaveLength(4);
});

test("random pieces are repeatable by seed and cover every shape", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seq = (rng: () => number) => Array.from({ length: 50 }, () => randomPiece(rng).shape.id);
  const run = seq(a);
  expect(run).toEqual(seq(b));
  const all = new Set(seq(mulberry32(7)).concat(seq(mulberry32(8)), run));
  expect(all.size).toBe(SHAPES.length);
});

test("random piece copes with an rng that returns almost 1", () => {
  expect(randomPiece(() => 0.999999).shape.id).toBe(SHAPES[SHAPES.length - 1]?.id);
  expect(() => randomPiece(() => 0, [])).toThrow();
});
