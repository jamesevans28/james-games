import { useQuery } from "@tanstack/react-query";
import { getTopScores } from "../lib/api";
import { queryKeys } from "../lib/queryClient";

export type LeaderboardScope = "overall" | "following";

/**
 * A game's top scores (T7.10). Refreshed by invalidateAfterRun after a saved run.
 * `viewerId` is part of the key for the "following" scope, whose rows depend on who asks.
 */
export function useLeaderboard(
  gameId: string | undefined,
  {
    limit = 10,
    scope = "overall",
    viewerId,
    enabled = true,
  }: { limit?: number; scope?: LeaderboardScope; viewerId?: string; enabled?: boolean } = {},
) {
  const viewer = scope === "following" ? (viewerId ?? "anon") : null;
  return useQuery({
    queryKey: [...queryKeys.leaderboard(gameId ?? ""), scope, limit, viewer],
    queryFn: () => getTopScores(gameId ?? "", limit, scope === "following" ? { scope } : undefined),
    enabled: Boolean(gameId) && enabled,
  });
}
