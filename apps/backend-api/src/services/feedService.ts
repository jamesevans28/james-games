import { listPlayedGameIds, rankGamesForFeed, type FeedRankRow } from "../repos/gamesRepo.js";
import { getUserById } from "../repos/usersRepo.js";

/**
 * Home feed order. One cached SQL ranking (featured, plays in the last 14 days,
 * average rating, last update) shared by everyone; the personalized feed then
 * mixes in what the viewer has and hasn't played (user_game_stats).
 */

/** The reasons player-web understands (useFeedAlgorithmV2 FeedReason, HomeFeed badges). */
export type FeedReason = "featured" | "user_recent" | "beta" | "popular";

export type FeedEntry = { gameId: string; reason: FeedReason };

export type FeedResponse = {
  orderedGameIds: string[];
  scores: Record<string, number>;
  reasons: Record<string, FeedReason>;
  total: number;
};

const CACHE_TTL_MS = 60_000;
const RECENT_PLAYS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

let cache: { at: number; rows: FeedRankRow[] } | null = null;

/** Drops the per-container ranking cache (after an admin edit, and in tests). */
export function clearFeedCache(): void {
  cache = null;
}

async function rankedGames(): Promise<FeedRankRow[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.rows;
  const rows = await rankGamesForFeed(new Date(now - RECENT_PLAYS_WINDOW_MS));
  cache = { at: now, rows };
  return rows;
}

/**
 * Pure ordering. Featured games first, then (for beta testers) beta games, then the
 * rest by rank. With a play history, the rest alternates between unplayed games
 * (by rank) and played games (most recent first), starting with an unplayed one.
 */
export function orderFeed(
  ranked: FeedRankRow[],
  opts: { includeBeta: boolean; played?: string[] },
): FeedEntry[] {
  const visible = ranked.filter(
    (g) => g.status === "active" || (opts.includeBeta && g.status === "beta"),
  );
  const featured: FeedEntry[] = visible
    .filter((g) => g.featured)
    .map((g) => ({ gameId: g.gameId, reason: "featured" }));
  const beta: FeedEntry[] = visible
    .filter((g) => !g.featured && g.status === "beta")
    .map((g) => ({ gameId: g.gameId, reason: "beta" }));
  const rest = visible.filter((g) => !g.featured && g.status !== "beta").map((g) => g.gameId);

  const played = opts.played ?? [];
  const restSet = new Set(rest);
  const playedSet = new Set(played);
  const playedRest: FeedEntry[] = played
    .filter((id) => restSet.has(id))
    .map((gameId) => ({ gameId, reason: "user_recent" }));
  const unplayed: FeedEntry[] = rest
    .filter((id) => !playedSet.has(id))
    .map((gameId) => ({ gameId, reason: "popular" }));

  const mixed: FeedEntry[] = [];
  for (let i = 0; i < Math.max(unplayed.length, playedRest.length); i += 1) {
    if (unplayed[i]) mixed.push(unplayed[i]!);
    if (playedRest[i]) mixed.push(playedRest[i]!);
  }
  return [...featured, ...beta, ...mixed];
}

function toResponse(entries: FeedEntry[], limit: number): FeedResponse {
  const limited = entries.slice(0, limit);
  const scores: Record<string, number> = {};
  const reasons: Record<string, FeedReason> = {};
  limited.forEach((e, i) => {
    scores[e.gameId] = entries.length - i;
    reasons[e.gameId] = e.reason;
  });
  return { orderedGameIds: limited.map((e) => e.gameId), scores, reasons, total: entries.length };
}

export function clampFeedLimit(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(n, 100);
}

/** GET /games/feed: active games only, the same for everyone. */
export async function getPublicFeed(limit: number): Promise<FeedResponse> {
  return toResponse(orderFeed(await rankedGames(), { includeBeta: false }), limit);
}

/** GET /games/feed/personalized: adds beta games for beta testers and the viewer's play history. */
export async function getPersonalizedFeed(
  userId: string,
  limit: number,
): Promise<FeedResponse & { userRecentGames: string[] }> {
  const [ranked, viewer, played] = await Promise.all([
    rankedGames(),
    getUserById(userId),
    listPlayedGameIds(userId),
  ]);
  const entries = orderFeed(ranked, { includeBeta: Boolean(viewer?.betaTester), played });
  return { ...toResponse(entries, limit), userRecentGames: played.slice(0, 20) };
}
