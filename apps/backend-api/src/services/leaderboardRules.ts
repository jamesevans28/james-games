/** Pure leaderboard rules (no database access). The ordering itself is done in SQL. */

export const LEADERBOARD_DEFAULT_LIMIT = 10;
export const LEADERBOARD_MAX_LIMIT = 50;

/** Rows to return for a `?limit=` value: a whole number from 1 to 50, default 10. */
export function leaderboardLimit(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return LEADERBOARD_DEFAULT_LIMIT;
  return Math.min(LEADERBOARD_MAX_LIMIT, n);
}

export type LeaderboardScope = "overall" | "following";

/** `?scope=following` (or `friends`) is the friends board; anything else is the overall board. */
export function leaderboardScope(raw: unknown): LeaderboardScope {
  return raw === "following" || raw === "friends" ? "following" : "overall";
}
