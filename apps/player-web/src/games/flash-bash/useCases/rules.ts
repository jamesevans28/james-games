/** Flash Bash rules: pure functions, no Phaser. Buttons are numbered 0–5. */

export const BUTTON_COUNT = 6;

/** Every button has a different shape, so colour is never the only clue. */
export const SHAPES = ["circle", "square", "triangle", "star", "diamond", "hexagon"] as const;
export type Shape = (typeof SHAPES)[number];

/** What one button shows: a shape and an index into the scene's colour palette. */
export type Face = { shape: Shape; color: number };

/** An integer in [0, n) from a [0, 1) random source. */
function pick(rng: () => number, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** Fisher–Yates shuffle of a copy. */
function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = pick(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const sameFaces = (a: readonly Face[], b: readonly Face[]) =>
  a.length === b.length && a.every((f, i) => f.shape === b[i]?.shape && f.color === b[i]?.color);

/**
 * Deals a shape and a colour to each button: every shape once, every colour once.
 * When `previous` is given the new layout is always different from it, so a
 * "new shapes" round really changes something.
 */
export function dealFaces(rng: () => number, previous?: readonly Face[]): Face[] {
  const colors = Array.from({ length: BUTTON_COUNT }, (_, i) => i);
  for (;;) {
    const shapes = shuffled(SHAPES, rng);
    const palette = shuffled(colors, rng);
    const faces = shapes.map((shape, i) => ({ shape, color: palette[i] ?? 0 }));
    if (!previous || !sameFaces(faces, previous)) return faces;
  }
}

/** A random sequence of button numbers. Repeats are allowed, as in Simon. */
export function sequence(rng: () => number, length: number): number[] {
  return Array.from({ length: Math.max(0, length) }, () => pick(rng, BUTTON_COUNT));
}

export type Verdict = "wrong" | "next" | "complete";

/**
 * Judges the presses so far against the expected sequence: "wrong" as soon as one
 * press differs (or there are too many), "complete" when every press matched,
 * otherwise "next".
 */
export function judge(input: readonly number[], expected: readonly number[]): Verdict {
  if (input.length > expected.length) return "wrong";
  if (input.some((b, i) => b !== expected[i])) return "wrong";
  return input.length === expected.length ? "complete" : "next";
}

/** One point for each correct press; nothing for a wrong one. */
export const pointsFor = (verdict: Verdict): number => (verdict === "wrong" ? 0 : 1);

/** Extra points for finishing a whole sequence. */
export const SEQUENCE_BONUS = 3;

/** Sequences played with the same shapes before they are reshuffled. */
export const SEQUENCES_PER_ROUND = 3;
export const MAX_LENGTH = 12;

export type Step = {
  /** 0-based round. The shapes stay put for a whole round. */
  round: number;
  /** True for the first sequence of a round: deal new shapes and a new pattern. */
  newRound: boolean;
  /** How many flashes to copy. */
  length: number;
  /** How long one flash stays on screen. */
  flashMs: number;
  /** The pause between flashes. */
  gapMs: number;
  /** Time allowed for each press before the run ends. */
  inputMs: number;
};

/**
 * The difficulty of the `n`th sequence of a run (0-based). Within a round the
 * pattern grows by one each time (Simon style). A new round starts a fresh
 * pattern one longer than the last round's first, with new shapes, quicker
 * flashes and a little less time per press.
 */
export function step(n: number): Step {
  const i = Math.max(0, Math.floor(n));
  const round = Math.floor(i / SEQUENCES_PER_ROUND);
  const inRound = i % SEQUENCES_PER_ROUND;
  return {
    round,
    newRound: inRound === 0,
    length: Math.min(MAX_LENGTH, 1 + round + inRound),
    flashMs: Math.max(450, 900 - 75 * round),
    gapMs: Math.max(120, 200 - 10 * round),
    inputMs: Math.max(2000, 3000 - 100 * round),
  };
}

/** The longest sequence in `round`, so one pattern can be dealt for the whole round. */
export function roundLength(round: number): number {
  return step(Math.max(0, round) * SEQUENCES_PER_ROUND + SEQUENCES_PER_ROUND - 1).length;
}
