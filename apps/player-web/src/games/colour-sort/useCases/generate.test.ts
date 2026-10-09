import { expect, test } from "vitest";
import { mulberry32 } from "../../../platform/rng";
import {
  MAX_COLOURS,
  applyReverse,
  generateLevel,
  levelConfig,
  reverseMoves,
  solvedBoard,
} from "./generate";
import { CAPACITY, isSolved, isTubeDone, pour, pourCount, type Board } from "./tubes";

/** Fewest moves to solve `board` (breadth-first search), or null if it can't be solved. */
function solve(board: Board, limit = 200_000): number | null {
  const key = (b: Board) =>
    b
      .map((t) => t.join(""))
      .sort()
      .join("|");
  let frontier: Board[] = [board];
  const seen = new Set([key(board)]);
  for (let depth = 0; frontier.length; depth++) {
    const next: Board[] = [];
    for (const b of frontier) {
      if (isSolved(b)) return depth;
      for (let from = 0; from < b.length; from++) {
        for (let to = 0; to < b.length; to++) {
          if (!pourCount(b, from, to)) continue;
          const n = pour(b, from, to);
          const k = key(n);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(n);
        }
      }
    }
    if (seen.size > limit) throw new Error("search too big");
    frontier = next;
  }
  return null;
}

function countColours(board: Board): Map<number, number> {
  const counts = new Map<number, number>();
  board.flat().forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
  return counts;
}

test("levelConfig adds a colour every three levels, up to six", () => {
  expect(levelConfig(1)).toEqual({ colours: 2, tubes: 4, scramble: 8 });
  expect(levelConfig(3)).toEqual({ colours: 2, tubes: 4, scramble: 12 });
  expect(levelConfig(4).colours).toBe(3);
  expect(levelConfig(13).colours).toBe(6);
  expect(levelConfig(20)).toEqual({ colours: 6, tubes: 8, scramble: 24 + 2 });
  expect(levelConfig(0).colours).toBe(2);
});

test("levelConfig follows the remix knobs and clamps silly values", () => {
  expect(levelConfig(20, { maxColours: 3 }).colours).toBe(3);
  expect(levelConfig(20, { maxColours: 99 }).colours).toBe(MAX_COLOURS);
  expect(levelConfig(1, { spare: 1 }).tubes).toBe(3);
  expect(levelConfig(1, { spare: 3 }).tubes).toBe(5);
  expect(levelConfig(1, { spare: 0 }).tubes).toBe(3);
  expect(levelConfig(1, { maxColours: 1 }).colours).toBe(2);
});

test("solvedBoard is full tubes of each colour, then empties", () => {
  expect(solvedBoard(2, 4)).toEqual([[0, 0, 0, 0], [1, 1, 1, 1], [], []]);
});

test("every reverse move can be poured straight back", () => {
  let board: Board = [[0, 1, 1], [1, 0], [0, 0, 1], []];
  for (const m of reverseMoves(board)) {
    const after = applyReverse(board, m);
    expect(pour(after, m.to, m.from)).toEqual(board);
  }
  board = solvedBoard(2, 3);
  // From solved, the only un-pours put 1–4 balls of one colour into the empty tube.
  expect(reverseMoves(board)).toHaveLength(8);
});

test("generated levels keep four of each colour and start mixed", () => {
  const rng = mulberry32(42);
  for (let level = 1; level <= 20; level++) {
    const cfg = levelConfig(level);
    const { board, par } = generateLevel(cfg, rng);
    expect(board).toHaveLength(cfg.tubes);
    expect(board.every((t) => t.length <= CAPACITY)).toBe(true);
    const counts = countColours(board);
    expect(counts.size).toBe(cfg.colours);
    expect([...counts.values()].every((n) => n === CAPACITY)).toBe(true);
    expect(isSolved(board)).toBe(false);
    expect(board.some((t) => isTubeDone(t))).toBe(false);
    expect(par).toBeGreaterThan(0);
    expect(par).toBeLessThanOrEqual(cfg.scramble);
  }
});

test("low levels are solvable within par (checked by search)", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = mulberry32(seed);
    for (let level = 1; level <= 6; level++) {
      const { board, par } = generateLevel(levelConfig(level), rng);
      const fewest = solve(board);
      expect(fewest).not.toBeNull();
      expect(fewest).toBeGreaterThanOrEqual(2);
      expect(fewest).toBeLessThanOrEqual(par);
    }
  }
});

test("remixed levels with one spare tube are still solvable", () => {
  const rng = mulberry32(7);
  for (let level = 1; level <= 6; level++) {
    const { board, par } = generateLevel(levelConfig(level, { spare: 1 }), rng);
    const fewest = solve(board);
    expect(fewest).not.toBeNull();
    expect(fewest).toBeLessThanOrEqual(par);
  }
});

test("the same seed makes the same level (daily challenge replays)", () => {
  const cfg = levelConfig(10);
  expect(generateLevel(cfg, mulberry32(5))).toEqual(generateLevel(cfg, mulberry32(5)));
});
