import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb, type Db } from "../db/client.js";
import { experienceLevels, userGameStats, users, type User } from "../db/schema.js";

/**
 * Pure data access for a player's progress: XP and streak columns on users, the
 * XP level table and per-game stats. Every function takes an optional `db` so the
 * score submission can run them inside one transaction.
 */

export type ExperienceLevel = typeof experienceLevels.$inferSelect;
export type UserGameStatsRow = typeof userGameStats.$inferSelect;
export type ProgressPatch = Partial<
  Pick<
    User,
    "xpTotal" | "xpLevel" | "xpProgress" | "streakCurrent" | "streakLongest" | "streakLastDay"
  >
>;

export async function listExperienceLevels(db: Db = getDb()): Promise<ExperienceLevel[]> {
  return db.select().from(experienceLevels).orderBy(asc(experienceLevels.level));
}

/** Reads a user row and locks it until the transaction ends (serialises XP and streak writes). */
export async function lockUser(db: Db, userId: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1).for("update");
  return row ?? null;
}

export async function updateUserProgress(
  db: Db,
  userId: string,
  patch: ProgressPatch,
): Promise<User | null> {
  const [row] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return row ?? null;
}

/** One more play of a game: plays + 1, best kept, last score and time replaced. */
export async function recordGamePlay(
  db: Db,
  row: { userId: string; gameId: string; score: number; playedAt: Date },
): Promise<UserGameStatsRow> {
  const [stats] = await db
    .insert(userGameStats)
    .values({
      userId: row.userId,
      gameId: row.gameId,
      plays: 1,
      bestScore: row.score,
      lastScore: row.score,
      lastPlayedAt: row.playedAt,
    })
    .onConflictDoUpdate({
      target: [userGameStats.userId, userGameStats.gameId],
      set: {
        plays: sql`${userGameStats.plays} + 1`,
        bestScore: sql`greatest(${userGameStats.bestScore}, excluded.best_score)`,
        lastScore: sql`excluded.last_score`,
        lastPlayedAt: sql`excluded.last_played_at`,
      },
    })
    .returning();
  return stats!;
}

export async function listRecentGameStats(
  userId: string,
  limit: number,
  db: Db = getDb(),
): Promise<UserGameStatsRow[]> {
  return db
    .select()
    .from(userGameStats)
    .where(eq(userGameStats.userId, userId))
    .orderBy(desc(userGameStats.lastPlayedAt))
    .limit(limit);
}
