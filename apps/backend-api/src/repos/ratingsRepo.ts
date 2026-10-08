import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { ratings } from "../db/schema.js";

/** Pure data access for star ratings (one row per player per game). */

export type RatingAggregate = { gameId: string; avgRating: number; ratingCount: number };

/** Inserts or replaces the player's stars for a game. */
export async function upsertRating(userId: string, gameId: string, stars: number): Promise<void> {
  await getDb()
    .insert(ratings)
    .values({ userId, gameId, stars })
    .onConflictDoUpdate({
      target: [ratings.userId, ratings.gameId],
      set: { stars, updatedAt: sql`now()` },
    });
}

/** Average stars and count per game; games with no ratings are absent. */
export async function aggregateRatings(gameIds: string[]): Promise<RatingAggregate[]> {
  if (!gameIds.length) return [];
  return getDb()
    .select({
      gameId: ratings.gameId,
      avgRating: sql<number>`avg(${ratings.stars})::float8`,
      ratingCount: sql<number>`count(*)::int`,
    })
    .from(ratings)
    .where(inArray(ratings.gameId, gameIds))
    .groupBy(ratings.gameId);
}

export async function getUserStars(userId: string, gameId: string): Promise<number | null> {
  const [row] = await getDb()
    .select({ stars: ratings.stars })
    .from(ratings)
    .where(and(eq(ratings.userId, userId), eq(ratings.gameId, gameId)))
    .limit(1);
  return row ? row.stars : null;
}
