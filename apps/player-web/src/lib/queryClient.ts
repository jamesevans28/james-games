/**
 * Server state (T7.10): one TanStack Query client for the app, the query keys every
 * screen shares, and what a finished run invalidates. Pages read server data through
 * hooks in src/hooks/ (useLeaderboard, useGameRatings, useGameCatalog) that use these keys.
 */
import { QueryClient } from "@tanstack/react-query";
import { shouldRetry } from "./apiError";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Nothing here changes by the second; one request per resource per screen.
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Query keys. A key is a prefix of every longer key that starts with it, so
 * `invalidateQueries({ queryKey: queryKeys.leaderboard(id) })` refreshes every
 * scope and limit of that game's board.
 */
export const queryKeys = {
  supporter: ["supporter"] as const,
  catalog: ["catalog"] as const,
  ratings: (gameId: string) => ["ratings", gameId] as const,
  leaderboard: (gameId: string) => ["leaderboard", gameId] as const,
  /** The signed-in player's own account (GET /me). */
  me: ["me"] as const,
  /** Public profiles; `profile()` alone matches all of them. */
  profile: (userId?: string) => (userId ? (["profile", userId] as const) : (["profile"] as const)),
  friends: ["friends"] as const,
  stickers: ["stickers"] as const,
  /** A saved remix by id (T11.2). */
  remix: (remixId: string) => ["remix", remixId] as const,
  /** Your own remixes of a game (T11.2). */
  myRemixes: (gameId: string) => ["remixes", "mine", gameId] as const,
  /** A remix's board; under the game's leaderboard key, so a saved run refreshes it. */
  remixBoard: (gameId: string, remixId: string) =>
    ["leaderboard", gameId, "remix", remixId] as const,
  /** Today's challenge and its board (T11.3). */
  daily: ["daily"] as const,
  /** Your family links and your kids' week (T11.7). */
  family: ["family"] as const,
};

/** After a score is saved: boards, ratings (play counts), the player's profile, XP and stickers. */
export function invalidateAfterRun(gameId: string, client: QueryClient = queryClient): void {
  void client.invalidateQueries({ queryKey: queryKeys.leaderboard(gameId) });
  void client.invalidateQueries({ queryKey: queryKeys.ratings(gameId) });
  void client.invalidateQueries({ queryKey: queryKeys.profile() });
  void client.invalidateQueries({ queryKey: queryKeys.me });
  void client.invalidateQueries({ queryKey: queryKeys.stickers });
}
