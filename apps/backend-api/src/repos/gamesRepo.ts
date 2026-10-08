import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { games, plays, ratings, userGameStats, type Game } from "../db/schema.js";

/**
 * Pure data access for games and the aggregates read about them (feed ranking,
 * admin play stats). Rows are seeded from the manifests; only `metadata` is written here.
 */

export type GameStatus = Game["status"];

export async function listGames(statuses?: GameStatus[]): Promise<Game[]> {
  const query = getDb().select().from(games);
  const filtered = statuses ? query.where(inArray(games.status, statuses)) : query;
  return filtered.orderBy(asc(games.id));
}

export async function getGame(id: string): Promise<Game | null> {
  const [row] = await getDb().select().from(games).where(eq(games.id, id)).limit(1);
  return row ?? null;
}

export async function updateGameMetadata(
  id: string,
  metadata: Record<string, unknown> | null,
): Promise<Game | null> {
  const [row] = await getDb()
    .update(games)
    .set({ metadata, updatedAt: new Date() })
    .where(eq(games.id, id))
    .returning();
  return row ?? null;
}

export type FeedRankRow = {
  gameId: string;
  status: GameStatus;
  featured: boolean;
  recentPlays: number;
  avgRating: number;
  ratingCount: number;
};

/**
 * Every listed (non-inactive) game, best first: admin-featured, then plays since
 * `since`, then average rating, then most recently updated. One query.
 */
export async function rankGamesForFeed(since: Date): Promise<FeedRankRow[]> {
  const db = getDb();
  const recent = db
    .select({ gameId: plays.gameId, n: sql<number>`count(*)::int`.as("recent_plays") })
    .from(plays)
    .where(gte(plays.createdAt, since))
    .groupBy(plays.gameId)
    .as("recent");
  const rated = db
    .select({
      gameId: ratings.gameId,
      avg: sql<number>`avg(${ratings.stars})::float8`.as("avg_rating"),
      count: sql<number>`count(*)::int`.as("rating_count"),
    })
    .from(ratings)
    .groupBy(ratings.gameId)
    .as("rated");

  const featured = sql<boolean>`coalesce(${games.metadata} -> 'featured' = 'true'::jsonb, false)`;
  const recentPlays = sql<number>`coalesce(${recent.n}, 0)`;
  const avgRating = sql<number>`coalesce(${rated.avg}, 0)`;

  return db
    .select({
      gameId: games.id,
      status: games.status,
      featured,
      recentPlays,
      avgRating,
      ratingCount: sql<number>`coalesce(${rated.count}, 0)`,
    })
    .from(games)
    .leftJoin(recent, eq(recent.gameId, games.id))
    .leftJoin(rated, eq(rated.gameId, games.id))
    .where(ne(games.status, "inactive"))
    .orderBy(
      desc(featured),
      desc(recentPlays),
      desc(avgRating),
      desc(games.updatedAt),
      asc(games.id),
    );
}

/** The games a player has played, most recent first. */
export async function listPlayedGameIds(userId: string, limit = 100): Promise<string[]> {
  const rows = await getDb()
    .select({ gameId: userGameStats.gameId })
    .from(userGameStats)
    .where(eq(userGameStats.userId, userId))
    .orderBy(desc(userGameStats.lastPlayedAt))
    .limit(limit);
  return rows.map((r) => r.gameId);
}

export type PlayAggregate = {
  totalPlays: number;
  averageScore: number;
  uniquePlayers: number;
  /** Plays per window, in the order the windows were given. */
  windowCounts: number[];
};

/** Plays, average score and distinct players for one game since `since`, plus counts per [start, end) window. */
export async function aggregatePlays(
  gameId: string,
  since: Date,
  windows: Array<{ start: Date; end: Date }>,
): Promise<PlayAggregate> {
  const windowCols = Object.fromEntries(
    windows.map((w, i) => [
      `w${i}`,
      sql<number>`(count(*) filter (where ${plays.createdAt} >= ${w.start.toISOString()}::timestamptz and ${plays.createdAt} < ${w.end.toISOString()}::timestamptz))::int`,
    ]),
  );
  const [row] = await getDb()
    .select({
      totalPlays: sql<number>`count(*)::int`,
      averageScore: sql<number>`coalesce(avg(${plays.score}), 0)::float8`,
      uniquePlayers: sql<number>`count(distinct ${plays.userId})::int`,
      ...windowCols,
    })
    .from(plays)
    .where(and(eq(plays.gameId, gameId), gte(plays.createdAt, since)));
  const r = (row ?? {}) as Record<string, number | undefined>;
  return {
    totalPlays: Number(r.totalPlays ?? 0),
    averageScore: Number(r.averageScore ?? 0),
    uniquePlayers: Number(r.uniquePlayers ?? 0),
    windowCounts: windows.map((_, i) => Number(r[`w${i}`] ?? 0)),
  };
}
