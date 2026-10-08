import { test } from "vitest";
import assert from "node:assert/strict";
import {
  DEFAULT_SCORE_LIMITS,
  ScoreRejected,
  limitsFor,
  multiplierFor,
  validateScoreSubmission,
  xpForScore,
  XP_PER_RUN_CAP,
} from "./scoringRules.js";

const L = DEFAULT_SCORE_LIMITS;
const rejects = (fn: () => unknown, code: string) =>
  assert.throws(fn, (e: unknown) => e instanceof ScoreRejected && e.code === code);

test("accepts a normal run and rounds the score", () => {
  assert.deepEqual(
    validateScoreSubmission({ gameId: "snapadile", score: 90, durationMs: 60_000 }, L),
    { gameId: "snapadile", score: 90, durationMs: 60_000 },
  );
  assert.equal(validateScoreSubmission({ gameId: "word-rush", score: 12.6 }, L).score, 13);
});

test("accepts the highest real live score (Box Cutter 87,682)", () => {
  assert.equal(
    validateScoreSubmission({ gameId: "box-cutter", score: 87_682, durationMs: 300_000 }, L).score,
    87_682,
  );
});

test("rejects bad game ids and bad scores", () => {
  rejects(() => validateScoreSubmission({ gameId: "", score: 1 }, L), "gameId_invalid");
  rejects(() => validateScoreSubmission({ gameId: "../etc", score: 1 }, L), "gameId_invalid");
  rejects(() => validateScoreSubmission({ gameId: "snapadile", score: "90" }, L), "score_invalid");
  rejects(() => validateScoreSubmission({ gameId: "snapadile", score: -1 }, L), "score_invalid");
  rejects(
    () => validateScoreSubmission({ gameId: "snapadile", score: Infinity }, L),
    "score_invalid",
  );
  rejects(() => validateScoreSubmission({ gameId: "snapadile", score: NaN }, L), "score_invalid");
});

test("rejects absurd scores (the 1e12 case)", () => {
  rejects(() => validateScoreSubmission({ gameId: "snapadile", score: 1e12 }, L), "score_too_high");
});

test("rejects scores earned impossibly fast", () => {
  rejects(
    () => validateScoreSubmission({ gameId: "snapadile", score: 5_000, durationMs: 1_000 }, L),
    "score_too_fast",
  );
});

test("ignores untrustworthy durations instead of trusting them", () => {
  assert.equal(
    validateScoreSubmission({ gameId: "snapadile", score: 10, durationMs: -5 }, L).durationMs,
    undefined,
  );
  assert.equal(
    validateScoreSubmission({ gameId: "snapadile", score: 10, durationMs: 1e12 }, L).durationMs,
    undefined,
  );
});

test("per-game limits and multipliers come from server config only", () => {
  assert.deepEqual(limitsFor({ metadata: { maxScore: 500, maxScorePerSecond: 10 } }), {
    maxScore: 500,
    maxScorePerSecond: 10,
  });
  assert.deepEqual(limitsFor(null), L);
  assert.deepEqual(limitsFor({ metadata: { maxScore: -3 } }), L);
  assert.equal(multiplierFor({ xpMultiplier: 2.92 }), 2.92);
  assert.equal(multiplierFor(null), 1);
  assert.equal(multiplierFor({ xpMultiplier: 0 }), 1);
});

test("xp is score × multiplier, at least 1, capped per run", () => {
  assert.equal(xpForScore(0, 5), 0);
  assert.equal(xpForScore(10, 0.01), 1);
  assert.equal(xpForScore(52, 2.92), 151);
  assert.equal(xpForScore(1_000_000, 25), XP_PER_RUN_CAP);
});
