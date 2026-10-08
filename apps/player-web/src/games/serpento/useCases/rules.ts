/** Serpento rules: pure functions, no Phaser. */
import { OPPOSITE, type Direction4 } from "../../../platform/input/gestures";

export type Cell = { x: number; y: number };
export type Board = { cols: number; rows: number };

/** 17 × 20 cells of 30 px fit between the HUD and the d-pad on the 540 × 960 design. */
export const BOARD: Board = { cols: 17, rows: 20 };

export const START_LENGTH = 3;
export const START_SPEED_MS = 200;
export const SPEED_STEP_MS = 5;
export const MIN_SPEED_MS = 80;

export type RunState = {
  /** Head first. */
  snake: Cell[];
  /** The direction of the last move. */
  dir: Direction4;
  /** null only when the snake fills the whole board. */
  food: Cell | null;
  /** Food eaten this run; also the score. */
  eaten: number;
};

export type StepOutcome = "moved" | "ate" | "crashed";

const DELTA: Record<Direction4, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

/** Any turn is allowed except straight back into the snake's own neck. */
export const canTurn = (current: Direction4, wanted: Direction4): boolean =>
  wanted !== OPPOSITE[current];

/** The direction the snake will actually take when the player asks for `wanted`. */
export const steer = (current: Direction4, wanted: Direction4): Direction4 =>
  canTurn(current, wanted) ? wanted : current;

/** Milliseconds between moves: 5 ms quicker per food, down to a floor of 80 ms. */
export function nextSpeed(foodEaten: number): number {
  return Math.max(MIN_SPEED_MS, START_SPEED_MS - SPEED_STEP_MS * Math.max(0, foodEaten));
}

/** True when `cell` is off the board or on one of `body`'s cells. */
export function collides(cell: Cell, body: readonly Cell[], board: Board): boolean {
  if (cell.x < 0 || cell.y < 0 || cell.x >= board.cols || cell.y >= board.rows) return true;
  return body.some((c) => sameCell(c, cell));
}

/** A random free cell for the food, or null when the snake fills the board. */
export function placeFood(snake: readonly Cell[], board: Board, rng: () => number): Cell | null {
  const taken = new Set(snake.map((c) => c.y * board.cols + c.x));
  const free: Cell[] = [];
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      if (!taken.has(y * board.cols + x)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.min(free.length - 1, Math.floor(rng() * free.length))] ?? null;
}

/** A three-long snake in the middle of the board heading right, and the first food. */
export function initialState(board: Board, rng: () => number): RunState {
  const x = Math.floor(board.cols / 2);
  const y = Math.floor(board.rows / 2);
  const snake = Array.from({ length: START_LENGTH }, (_, i) => ({ x: x - i, y }));
  return { snake, dir: "right", food: placeFood(snake, board, rng), eaten: 0 };
}

/** Count the food and put a new one on a free cell. */
export function eat(state: RunState, board: Board, rng: () => number): RunState {
  return { ...state, eaten: state.eaten + 1, food: placeFood(state.snake, board, rng) };
}

/**
 * One move. The head goes one cell towards `wanted` (or straight on if that would
 * reverse). Landing on the food grows the snake by one and places new food; otherwise
 * the tail moves up, so the head may take the cell the tail is leaving.
 */
export function step(
  state: RunState,
  wanted: Direction4,
  board: Board,
  rng: () => number,
): { state: RunState; outcome: StepOutcome } {
  const dir = steer(state.dir, wanted);
  const head = state.snake[0];
  if (!head) return { state: { ...state, dir }, outcome: "crashed" };
  const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
  const eats = state.food !== null && sameCell(next, state.food);
  const body = eats ? state.snake : state.snake.slice(0, -1);
  if (collides(next, body, board)) return { state: { ...state, dir }, outcome: "crashed" };
  const moved: RunState = { ...state, dir, snake: [next, ...body] };
  if (!eats) return { state: moved, outcome: "moved" };
  return { state: eat(moved, board, rng), outcome: "ate" };
}
