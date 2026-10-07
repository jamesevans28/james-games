/**
 * Pure rules for accepting a score and turning it into XP. The server owns
 * every number here; nothing a client sends can change a limit or multiplier.
 */

export type ScoreLimits = { maxScore: number; maxScorePerSecond: number };

/**
 * Defaults until per-game manifests supply real limits (plan T4.3 / T6.6).
 * Highest live score on 2026-10-08 was 87,682 (Box Cutter), so 1,000,000 leaves headroom.
 */
export const DEFAULT_SCORE_LIMITS: ScoreLimits = { maxScore: 1_000_000, maxScorePerSecond: 2_000 };

/** A run longer than this is treated as "no duration" rather than trusted. */
const MAX_TRUSTED_DURATION_MS = 6 * 60 * 60 * 1000;

export const XP_PER_RUN_CAP = 5000;

export class ScoreRejected extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

type ConfigLike = { xpMultiplier?: unknown; metadata?: Record<string, unknown> | null } | null | undefined;

const positive = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;

/** Limits for a game: optional `metadata.maxScore` / `metadata.maxScorePerSecond` override the defaults. */
export function limitsFor(config: ConfigLike): ScoreLimits {
  return {
    maxScore: positive(config?.metadata?.maxScore) ?? DEFAULT_SCORE_LIMITS.maxScore,
    maxScorePerSecond:
      positive(config?.metadata?.maxScorePerSecond) ?? DEFAULT_SCORE_LIMITS.maxScorePerSecond,
  };
}

/** Server-side XP multiplier for a game; unknown games get 1. */
export function multiplierFor(config: ConfigLike): number {
  return positive(config?.xpMultiplier) ?? 1;
}

export type ValidScore = { gameId: string; score: number; durationMs?: number };

export function validateScoreSubmission(
  input: { gameId?: unknown; score?: unknown; durationMs?: unknown },
  limits: ScoreLimits
): ValidScore {
  const { gameId, score, durationMs } = input;
  if (typeof gameId !== "string" || !/^[a-z0-9-]{1,40}$/.test(gameId)) {
    throw new ScoreRejected("gameId_invalid");
  }
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
    throw new ScoreRejected("score_invalid");
  }
  const rounded = Math.round(score);
  if (rounded > limits.maxScore) throw new ScoreRejected("score_too_high");

  let trustedDuration: number | undefined;
  if (typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0) {
    if (durationMs <= MAX_TRUSTED_DURATION_MS) trustedDuration = Math.round(durationMs);
  }
  if (trustedDuration !== undefined && rounded / (trustedDuration / 1000) > limits.maxScorePerSecond) {
    throw new ScoreRejected("score_too_fast");
  }
  return { gameId, score: rounded, durationMs: trustedDuration };
}

/** XP for one run: score × server multiplier, at least 1 for a positive score, capped per run. */
export function xpForScore(score: number, multiplier: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  const m = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  return Math.min(XP_PER_RUN_CAP, Math.max(1, Math.floor(score * m)));
}
