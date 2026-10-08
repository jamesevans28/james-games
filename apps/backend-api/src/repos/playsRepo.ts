import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, type Db } from "../db/client.js";
import { bestScores, follows, games, plays, users, type Game, type Play } from "../db/schema.js";

/** Pure data access for plays, best scores and the leaderboards. Services own the rules. */

export async function getGameById(gameId: string, db: Db = getDb()): Promise<Game | null> {
  const [row] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  return row ?? null;
}

export async function insertPlay(
  db: Db,
  row: {
    userId: string;
    gameId: string;
    score: number;
    durationMs: number | null;
    xpAwarded: number;
  },
): Promise<Play> {
  const [play] = await db.insert(plays).values(row).returning();
  return play!;
}

/**
 * Records a best score when it beats the stored one (or is the first). Returns the
 * new row, or null when the stored best is equal or higher.
 */
export async function upsertBestScore(
  db: Db,
  row: { userId: string; gameId: string; score: number; playId: string; achievedAt: Date },
): Promise<typeof bestScores.$inferSelect | null> {
  const [best] = await db
    .insert(bestScores)
    .values(row)
    .onConflictDoUpdate({
      target: [bestScores.userId, bestScores.gameId],
      set: {
        score: sql`excluded.score`,
        playId: sql`excluded.play_id`,
        achievedAt: sql`excluded.achieved_at`,
      },
      setWhere: sql`${bestScores.score} < excluded.score`,
    })
    .returning();
  return best ?? null;
}

export type LeaderboardRow = {
  userId: string;
  screenName: string;
  avatar: number;
  level: number;
  score: number;
  achievedAt: Date;
};

/**
 * Top best scores for a game (highest first, earlier wins a tie), public user
 * fields only. Disabled accounts are left out. With `friendsOf`, only that player
 * and the players they follow (accepted) are included.
 */
export async function listLeaderboard(
  gameId: string,
  limit: number,
  opts: { friendsOf?: string } = {},
  db: Db = getDb(),
): Promise<LeaderboardRow[]> {
  const conditions = [eq(bestScores.gameId, gameId), isNull(users.disabledAt)];
  if (opts.friendsOf) {
    const viewer = opts.friendsOf;
    const followed = db
      .select({ id: follows.targetUserId })
      .from(follows)
      .where(and(eq(follows.userId, viewer), eq(follows.status, "accepted")));
    conditions.push(or(eq(bestScores.userId, viewer), inArray(bestScores.userId, followed))!);
  }
  return db
    .select({
      userId: bestScores.userId,
      screenName: users.screenName,
      avatar: users.avatar,
      level: users.xpLevel,
      score: bestScores.score,
      achievedAt: bestScores.achievedAt,
    })
    .from(bestScores)
    .innerJoin(users, eq(users.id, bestScores.userId))
    .where(and(...conditions))
    .orderBy(desc(bestScores.score), asc(bestScores.achievedAt))
    .limit(limit);
}
