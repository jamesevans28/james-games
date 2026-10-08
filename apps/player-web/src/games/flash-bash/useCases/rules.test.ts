import { test, expect } from "vitest";
import {
  BUTTON_COUNT,
  dealFaces,
  judge,
  MAX_LENGTH,
  pointsFor,
  roundLength,
  SEQUENCE_BONUS,
  SEQUENCES_PER_ROUND,
  sequence,
  SHAPES,
  step,
} from "./rules";
import { mulberry32 } from "../../../platform/rng";

test("a sequence has the asked length and only real buttons", () => {
  const seq = sequence(mulberry32(1), 50);
  expect(seq).toHaveLength(50);
  for (const b of seq) {
    expect(Number.isInteger(b)).toBe(true);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(BUTTON_COUNT);
  }
  expect(sequence(mulberry32(1), 0)).toEqual([]);
  expect(sequence(mulberry32(1), -3)).toEqual([]);
});

test("a sequence is repeatable by seed", () => {
  expect(sequence(mulberry32(42), 12)).toEqual(sequence(mulberry32(42), 12));
  expect(sequence(mulberry32(42), 12)).not.toEqual(sequence(mulberry32(43), 12));
});

test("an rng that returns exactly 1 still picks a real button", () => {
  expect(sequence(() => 0.999999999, 3)).toEqual([5, 5, 5]);
  expect(sequence(() => 1, 1)).toEqual([BUTTON_COUNT - 1]);
});

test("judge: correct so far, complete, or wrong", () => {
  expect(judge([], [2, 4, 1])).toBe("next");
  expect(judge([2], [2, 4, 1])).toBe("next");
  expect(judge([2, 4], [2, 4, 1])).toBe("next");
  expect(judge([2, 4, 1], [2, 4, 1])).toBe("complete");
  expect(judge([3], [2, 4, 1])).toBe("wrong");
  expect(judge([2, 4, 0], [2, 4, 1])).toBe("wrong");
});

test("judge: a press after the sequence is finished is wrong", () => {
  expect(judge([2, 4, 1, 1], [2, 4, 1])).toBe("wrong");
});

test("only correct presses score", () => {
  expect(pointsFor("next")).toBe(1);
  expect(pointsFor("complete")).toBe(1);
  expect(pointsFor("wrong")).toBe(0);
  expect(SEQUENCE_BONUS).toBe(3);
});

test("faces: every shape and every colour exactly once", () => {
  const rng = mulberry32(7);
  for (let k = 0; k < 20; k++) {
    const faces = dealFaces(rng);
    expect(faces).toHaveLength(BUTTON_COUNT);
    expect(new Set(faces.map((f) => f.shape))).toEqual(new Set(SHAPES));
    expect(new Set(faces.map((f) => f.color))).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  }
});

test("faces: a reshuffle always changes the layout", () => {
  const rng = mulberry32(3);
  let prev = dealFaces(rng);
  for (let k = 0; k < 50; k++) {
    const next = dealFaces(rng, prev);
    expect(next).not.toEqual(prev);
    prev = next;
  }
});

test("faces: a reshuffle that comes out the same is dealt again", () => {
  // An rng stuck at 0 deals the same layout every time until it moves on.
  let calls = 0;
  const stuck = () => (calls++ < 2 * (BUTTON_COUNT - 1) * 2 ? 0 : 0.5);
  const first = dealFaces(() => 0);
  const next = dealFaces(stuck, first);
  expect(next).not.toEqual(first);
});

test("faces are repeatable by seed", () => {
  expect(dealFaces(mulberry32(11))).toEqual(dealFaces(mulberry32(11)));
});

test("the first round starts at one flash and grows by one", () => {
  expect(step(0)).toEqual({
    round: 0,
    newRound: true,
    length: 1,
    flashMs: 900,
    gapMs: 200,
    inputMs: 3000,
  });
  expect(step(1)).toMatchObject({ round: 0, newRound: false, length: 2 });
  expect(step(2)).toMatchObject({ round: 0, newRound: false, length: 3 });
});

test("a new round deals new shapes, starts longer and plays faster", () => {
  const r1 = step(SEQUENCES_PER_ROUND);
  expect(r1).toMatchObject({ round: 1, newRound: true, length: 2 });
  expect(r1.flashMs).toBeLessThan(step(0).flashMs);
  expect(r1.inputMs).toBeLessThan(step(0).inputMs);
  expect(step(6)).toMatchObject({ round: 2, newRound: true, length: 3 });
});

test("difficulty never gets easier within a round, and has floors", () => {
  for (let n = 0; n < 300; n++) {
    const a = step(n);
    const b = step(n + 1);
    expect(b.round).toBeGreaterThanOrEqual(a.round);
    expect(b.flashMs).toBeLessThanOrEqual(a.flashMs);
    expect(b.gapMs).toBeLessThanOrEqual(a.gapMs);
    expect(b.inputMs).toBeLessThanOrEqual(a.inputMs);
    if (!b.newRound) expect(b.length).toBeGreaterThanOrEqual(a.length);
    expect(b.length).toBeLessThanOrEqual(MAX_LENGTH);
  }
  expect(step(1000)).toMatchObject({ length: MAX_LENGTH, flashMs: 450, gapMs: 120, inputMs: 2000 });
});

test("odd step numbers are clamped", () => {
  expect(step(-4)).toEqual(step(0));
  expect(step(1.7)).toEqual(step(1));
});

test("a round's pattern is long enough for every sequence in it", () => {
  for (let round = 0; round < 20; round++) {
    const len = roundLength(round);
    for (let k = 0; k < SEQUENCES_PER_ROUND; k++) {
      expect(step(round * SEQUENCES_PER_ROUND + k).length).toBeLessThanOrEqual(len);
    }
  }
  expect(roundLength(0)).toBe(3);
});
