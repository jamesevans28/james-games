import { test, expect } from "vitest";
import {
  BOARD,
  canTurn,
  collides,
  eat,
  initialState,
  nextSpeed,
  placeFood,
  steer,
  step,
  type Board,
  type Cell,
  type RunState,
} from "./rules";
import { mulberry32 } from "../../../platform/rng";

const board: Board = { cols: 5, rows: 5 };
const never = () => 0;
const state = (snake: Cell[], dir: RunState["dir"], food: Cell | null = null): RunState => ({
  snake,
  dir,
  food,
  eaten: 0,
});

test("never turns straight back into its own neck", () => {
  expect(canTurn("right", "left")).toBe(false);
  expect(canTurn("up", "down")).toBe(false);
  expect(canTurn("right", "up")).toBe(true);
  expect(canTurn("right", "right")).toBe(true);
  expect(steer("left", "right")).toBe("left");
  expect(steer("down", "up")).toBe("down");
  expect(steer("down", "left")).toBe("left");
});

test("a reverse request keeps the snake going straight", () => {
  const s = state(
    [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ],
    "right",
  );
  const { state: after, outcome } = step(s, "left", board, never);
  expect(outcome).toBe("moved");
  expect(after.dir).toBe("right");
  expect(after.snake[0]).toEqual({ x: 3, y: 2 });
});

test("moving keeps the length; the tail follows", () => {
  const s = state(
    [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    "right",
    { x: 4, y: 4 },
  );
  const { state: after, outcome } = step(s, "up", board, never);
  expect(outcome).toBe("moved");
  expect(after.dir).toBe("up");
  expect(after.snake).toEqual([
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ]);
  expect(after.eaten).toBe(0);
  expect(after.food).toEqual({ x: 4, y: 4 });
  expect(s.snake).toHaveLength(3); // the input state is untouched
});

test("eating grows the snake by one, scores and places new food on a free cell", () => {
  const s = state(
    [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ],
    "right",
    { x: 3, y: 2 },
  );
  const { state: after, outcome } = step(s, "right", board, mulberry32(3));
  expect(outcome).toBe("ate");
  expect(after.eaten).toBe(1);
  expect(after.snake).toEqual([
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ]);
  expect(after.food).not.toBeNull();
  expect(collides(after.food as Cell, after.snake, board)).toBe(false);
});

test("hitting a wall crashes", () => {
  const s = state([{ x: 4, y: 0 }], "right");
  expect(step(s, "right", board, never).outcome).toBe("crashed");
  expect(step(s, "up", board, never).outcome).toBe("crashed");
  expect(step(state([{ x: 0, y: 4 }], "down"), "left", board, never).outcome).toBe("crashed");
  expect(step(state([{ x: 0, y: 4 }], "left"), "down", board, never).outcome).toBe("crashed");
});

test("biting its own body crashes", () => {
  // A hook: the head at (1,1) turning down runs into (1,2).
  const s = state(
    [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    "left",
  );
  expect(step(s, "down", board, never).outcome).toBe("crashed");
});

test("the head may take the cell the tail is leaving, but not if it is growing", () => {
  // A 2×2 loop: the head at (1,1) moving up into (1,0), where the tail is.
  const loop = [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ];
  expect(step(state(loop, "right"), "up", board, never).outcome).toBe("moved");
  // If the food sits on the tail cell, the tail would stay, so that is a crash.
  const growing = { ...state(loop, "right"), food: { x: 1, y: 0 } };
  expect(step(growing, "up", board, never).outcome).toBe("crashed");
});

test("a snake with no cells crashes rather than throwing", () => {
  expect(step(state([], "up"), "up", board, never).outcome).toBe("crashed");
});

test("collides: walls on every side and the body", () => {
  expect(collides({ x: -1, y: 0 }, [], board)).toBe(true);
  expect(collides({ x: 0, y: -1 }, [], board)).toBe(true);
  expect(collides({ x: 5, y: 0 }, [], board)).toBe(true);
  expect(collides({ x: 0, y: 5 }, [], board)).toBe(true);
  expect(collides({ x: 4, y: 4 }, [], board)).toBe(false);
  expect(collides({ x: 2, y: 2 }, [{ x: 2, y: 2 }], board)).toBe(true);
});

test("speed: 5 ms quicker per food, to an 80 ms floor", () => {
  expect(nextSpeed(0)).toBe(200);
  expect(nextSpeed(1)).toBe(195);
  expect(nextSpeed(10)).toBe(150);
  expect(nextSpeed(24)).toBe(80);
  expect(nextSpeed(500)).toBe(80);
  expect(nextSpeed(-3)).toBe(200);
});

test("food lands only on free cells, repeatably by seed", () => {
  const full: Cell[] = [];
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) full.push({ x, y });
  const tiny: Board = { cols: 2, rows: 2 };
  expect(placeFood(full, tiny, Math.random)).toBeNull();
  expect(placeFood(full.slice(1), tiny, () => 0.99)).toEqual({ x: 0, y: 0 });
  expect(placeFood(full.slice(0, 3), tiny, () => 0.99)).toEqual({ x: 1, y: 1 });

  const rng = mulberry32(42);
  for (let i = 0; i < 200; i++) {
    const food = placeFood(full.slice(0, 2), tiny, rng);
    expect(food).not.toBeNull();
    expect(collides(food as Cell, full.slice(0, 2), tiny)).toBe(false);
  }

  const seq = (r: () => number) => Array.from({ length: 10 }, () => placeFood([], BOARD, r));
  expect(seq(mulberry32(7))).toEqual(seq(mulberry32(7)));
});

test("eat counts the food and moves it", () => {
  const s = state([{ x: 0, y: 0 }], "right", { x: 0, y: 0 });
  const after = eat(s, { cols: 2, rows: 1 }, never);
  expect(after.eaten).toBe(1);
  expect(after.food).toEqual({ x: 1, y: 0 });
});

test("a run starts three long in the middle, heading right, with food off the snake", () => {
  const s = initialState(BOARD, mulberry32(1));
  expect(s.snake).toEqual([
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ]);
  expect(s.dir).toBe("right");
  expect(s.eaten).toBe(0);
  expect(s.food).not.toBeNull();
  expect(collides(s.food as Cell, s.snake, BOARD)).toBe(false);
});
