/** Pure leaderboard rules (no database access). */

export type ScoreLike = { userId?: string; score: number; createdAt: string };
export type StatLike = { userId: string; bestScore?: number; lastPlayedAt?: string };

/** Highest score first; an earlier time wins a tie. */
export function compareScores(a: ScoreLike, b: ScoreLike): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.createdAt.localeCompare(b.createdAt);
}

/**
 * One best entry per allowed user, from two partial sources: score rows (the
 * global top list) and per-user stats rows (best score per user and game).
 * Either source may be missing a user, so the best of both wins.
 */
export function bestPerUser(
  rows: ScoreLike[],
  stats: StatLike[],
  allowed: Set<string>,
): ScoreLike[] {
  const best = new Map<string, ScoreLike>();
  const consider = (candidate: ScoreLike) => {
    if (!candidate.userId || !allowed.has(candidate.userId)) return;
    const current = best.get(candidate.userId);
    if (!current || compareScores(candidate, current) < 0) best.set(candidate.userId, candidate);
  };
  rows.forEach(consider);
  for (const s of stats) {
    if (typeof s.bestScore === "number" && s.bestScore > 0) {
      consider({ userId: s.userId, score: s.bestScore, createdAt: s.lastPlayedAt ?? "" });
    }
  }
  return [...best.values()].sort(compareScores);
}
