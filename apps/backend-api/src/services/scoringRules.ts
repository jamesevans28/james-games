/**
 * Pure rules for accepting a score and turning it into XP. The server owns
 * every number here; nothing a client sends can change a limit or multiplier.
 */

export type ScoreLimits = { maxScore: number; maxScorePerSecond: number };

/** Fallback when a games row has a non-positive limit (seeded rows always have real ones, T6.6). */
export const DEFAULT_SCORE_LIMITS: ScoreLimits = { maxScore: 1_000_000, maxScorePerSecond: 2_000 };

/** A run longer than this is treated as "no duration" rather than trusted. */
const MAX_TRUSTED_DURATION_MS = 6 * 60 * 60 * 1000;

export const XP_PER_RUN_CAP = 5000;

/** A submission the server refuses. `status` is the HTTP status (400 unless said otherwise). */
export class ScoreRejected extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number = 400,
  ) {
    super(code);
  }
}

/** The games-row fields the rules read (max_score, max_score_per_second, xp_multiplier, status). */
type GameLike = {
  status?: "active" | "beta" | "inactive";
  maxScore?: unknown;
  maxScorePerSecond?: unknown;
  xpMultiplier?: unknown;
};

const positive = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;

/** Limits for a game, from its games row. */
export function limitsFor(game: GameLike | null | undefined): ScoreLimits {
  return {
    maxScore: positive(game?.maxScore) ?? DEFAULT_SCORE_LIMITS.maxScore,
    maxScorePerSecond: positive(game?.maxScorePerSecond) ?? DEFAULT_SCORE_LIMITS.maxScorePerSecond,
  };
}

/** Server-side XP multiplier for a game; a missing or bad value gives 1. */
export function multiplierFor(game: GameLike | null | undefined): number {
  return positive(game?.xpMultiplier) ?? 1;
}

/** Game ids are manifest folder names. */
export function isValidGameId(v: unknown): v is string {
  return typeof v === "string" && /^[a-z0-9-]{1,40}$/.test(v);
}

/**
 * Whether a player may post a score for a game: unknown and inactive games take
 * no scores; beta games only from beta testers; disabled accounts never.
 */
export function assertCanSubmit<P extends { betaTester: boolean; disabledAt: Date | null }>(
  game: GameLike | null,
  player: P | null,
): P {
  if (!game) throw new ScoreRejected("game_not_found", 404);
  if (!player) throw new ScoreRejected("user_not_found", 404);
  if (player.disabledAt) throw new ScoreRejected("account_disabled", 403);
  if (game.status === "inactive") throw new ScoreRejected("game_inactive", 400);
  if (game.status === "beta" && !player.betaTester) throw new ScoreRejected("game_beta_only", 403);
  return player;
}

export type ValidScore = { gameId: string; score: number; durationMs?: number };

export function validateScoreSubmission(
  input: { gameId?: unknown; score?: unknown; durationMs?: unknown },
  limits: ScoreLimits,
): ValidScore {
  const { gameId, score, durationMs } = input;
  if (!isValidGameId(gameId)) throw new ScoreRejected("gameId_invalid");
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
    throw new ScoreRejected("score_invalid");
  }
  const rounded = Math.round(score);
  if (rounded > limits.maxScore) throw new ScoreRejected("score_too_high");

  let trustedDuration: number | undefined;
  if (typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0) {
    if (durationMs <= MAX_TRUSTED_DURATION_MS) trustedDuration = Math.round(durationMs);
  }
  if (
    trustedDuration !== undefined &&
    rounded / (trustedDuration / 1000) > limits.maxScorePerSecond
  ) {
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
