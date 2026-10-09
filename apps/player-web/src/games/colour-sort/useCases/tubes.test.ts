import { expect, test } from "vitest";
import {
  canPour,
  isSolved,
  isTubeDone,
  pour,
  pourCount,
  tap,
  topColour,
  topRun,
  type Board,
} from "./tubes";

test("topColour and topRun read the top of a tube", () => {
  expect(topColour([])).toBeNull();
  expect(topRun([])).toBe(0);
  expect(topColour([0, 1, 1])).toBe(1);
  expect(topRun([0, 1, 1])).toBe(2);
  expect(topRun([2, 2, 2, 2])).toBe(4);
});

test("pour moves the whole top run onto a matching colour", () => {
  const board: Board = [[0, 1, 1], [2, 1], []];
  expect(pourCount(board, 0, 1)).toBe(2);
  expect(pour(board, 0, 1)).toEqual([[0], [2, 1, 1, 1], []]);
});

test("pour into an empty tube is always allowed", () => {
  const board: Board = [[0, 1, 1], []];
  expect(pour(board, 0, 1)).toEqual([[0], [1, 1]]);
});

test("pour only moves as many balls as fit", () => {
  const board: Board = [
    [1, 1, 1],
    [0, 0, 1],
  ];
  expect(pourCount(board, 0, 1)).toBe(1);
  expect(pour(board, 0, 1)).toEqual([
    [1, 1],
    [0, 0, 1, 1],
  ]);
});

test("pour is refused on a colour clash, a full tube, an empty source or the same tube", () => {
  const board: Board = [[0, 1], [1, 0], [2, 2, 2, 2], []];
  expect(canPour(board, 0, 1)).toBe(false); // 1 onto 0
  expect(canPour(board, 0, 2)).toBe(false); // full
  expect(canPour(board, 3, 0)).toBe(false); // nothing to pour
  expect(canPour(board, 0, 0)).toBe(false);
  expect(canPour(board, 0, 9)).toBe(false); // no such tube
  expect(pour(board, 0, 1)).toBe(board);
});

test("a tube is done when it is full of one colour", () => {
  expect(isTubeDone([1, 1, 1, 1])).toBe(true);
  expect(isTubeDone([1, 1, 1])).toBe(false);
  expect(isTubeDone([0, 1, 1, 1])).toBe(false);
});

test("the board is solved when every tube is empty or done", () => {
  expect(isSolved([[0, 0, 0, 0], [1, 1, 1, 1], []])).toBe(true);
  expect(
    isSolved([
      [0, 0, 0, 0],
      [1, 1],
      [1, 1],
    ]),
  ).toBe(false);
  expect(isSolved([[0, 0, 0, 1], [1, 1, 1, 0], []])).toBe(false);
});

test("tap picks up, puts down, pours and switches", () => {
  const board: Board = [[0, 1], [1], [0, 0], []];
  expect(tap(board, null, 0)).toEqual({ kind: "select", selected: 0 });
  expect(tap(board, null, 3)).toEqual({ kind: "nope", selected: null });
  expect(tap(board, 0, 0)).toEqual({ kind: "deselect" });
  expect(tap(board, 0, 1)).toEqual({ kind: "pour", from: 0, to: 1, count: 1 });
  expect(tap(board, 0, 3)).toEqual({ kind: "pour", from: 0, to: 3, count: 1 });
  // 1 can't go on 0, so the tap picks up the other tube instead.
  expect(tap(board, 0, 2)).toEqual({ kind: "select", selected: 2 });
  expect(tap(board, 0, 7)).toEqual({ kind: "nope", selected: 0 });
});

test("tap won't pick up or switch to a finished tube", () => {
  const board: Board = [
    [0, 1],
    [2, 2, 2, 2],
  ];
  expect(tap(board, 0, 1)).toEqual({ kind: "nope", selected: 0 });
  expect(tap(board, null, 1)).toEqual({ kind: "nope", selected: null });
});
