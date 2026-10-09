import { useQuery } from "@tanstack/react-query";
import { fetchRemix, getRemixScores } from "../../../lib/api";
import { queryKeys } from "../../../lib/queryClient";

/**
 * A saved remix's board (T11.2): each player's best run on it. Keyed under the game's
 * leaderboard, so invalidateAfterRun refreshes it after a saved run.
 */
export function useRemixLeaderboard(
  gameId: string | undefined,
  remixId: string | null,
  { limit = 25, enabled = true }: { limit?: number; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: [...queryKeys.remixBoard(gameId ?? "", remixId ?? ""), limit],
    queryFn: () => getRemixScores(remixId ?? "", limit),
    enabled: Boolean(gameId && remixId) && enabled,
  });
}

/** The remix itself (name and maker) for headings; shares the landing page's cache. */
export function useRemixInfo(remixId: string | null) {
  return useQuery({
    queryKey: queryKeys.remix(remixId ?? ""),
    queryFn: () => fetchRemix(remixId ?? ""),
    enabled: Boolean(remixId),
  });
}
