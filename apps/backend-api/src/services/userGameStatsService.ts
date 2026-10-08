import { listRecentGameStats } from "../repos/statsRepo.js";

/** A player's per-game stats as the public profile shows them. */
export type UserGameStat = {
  userId: string;
  gameId: string;
  bestScore?: number;
  lastScore?: number;
  lastPlayedAt?: string;
};

/** The games a player played most recently (user_game_stats is written by POST /scores). */
export async function getRecentGamesForUser(userId: string, limit = 5): Promise<UserGameStat[]> {
  const rows = await listRecentGameStats(userId, limit);
  return rows.map((r) => ({
    userId: r.userId,
    gameId: r.gameId,
    bestScore: r.bestScore,
    lastScore: r.lastScore,
    lastPlayedAt: r.lastPlayedAt.toISOString(),
  }));
}
