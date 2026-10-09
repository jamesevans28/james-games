import { and, asc, count, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getDb, type Db } from "../db/client.js";
import { dailyRuns, games, users } from "../db/schema.js";
import { blockedEitherWay } from "./blocksRepo.js";

/** Pure data access for the daily challenge (T11.3). Services own the rules. */

/** Ids of the games everyone can play, for the daily rotation. */
export async function listActiveGameIds(db: Db = getDb()): Promise<string[]> {
  const rows = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.status, "active"))
    .orderBy(asc(games.id));
  return rows.map((r) => r.id);
}

/** Records a player's daily run once. Returns true only when this call saved it. */
export async function insertDailyRun(
  db: Db,
  row: { userId: string; day: string; gameId: string; score: number; playId: string },
): Promise<boolean> {
  const inserted = await db
    .insert(dailyRuns)
    .values(row)
    .onConflictDoNothing({ target: [dailyRuns.userId, dailyRuns.day] })
    .returning({ day: dailyRuns.day });
  return inserted.length > 0;
}

export async function getDailyRun(
  userId: string,
  day: string,
  db: Db = getDb(),
): Promise<{ gameId: string; score: number } | null> {
  const [row] = await db
    .select({ gameId: dailyRuns.gameId, score: dailyRuns.score })
    .from(dailyRuns)
    .where(and(eq(dailyRuns.userId, userId), eq(dailyRuns.day, day)))
    .limit(1);
  return row ?? null;
}

/** How many daily runs a player has between two days (inclusive). */
export async function countDailyRunsBetween(
  db: Db,
  userId: string,
  from: string,
  to: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(dailyRuns)
    .where(and(eq(dailyRuns.userId, userId), gte(dailyRuns.day, from), lte(dailyRuns.day, to)));
  return Number(row?.n ?? 0);
}

export type DailyBoardRow = {
  userId: string;
  screenName: string;
  avatar: number;
  level: number;
  score: number;
};

/**
 * The day's board, highest first (earlier wins a tie), public fields only.
 * Disabled accounts are left out, and so is anyone in a block with the viewer.
 */
export async function listDailyBoard(
  day: string,
  limit: number,
  viewerId?: string,
  db: Db = getDb(),
): Promise<DailyBoardRow[]> {
  const conditions = [eq(dailyRuns.day, day), isNull(users.disabledAt)];
  if (viewerId) conditions.push(sql`not ${blockedEitherWay(dailyRuns.userId, viewerId)}`);
  return db
    .select({
      userId: dailyRuns.userId,
      screenName: users.screenName,
      avatar: users.avatar,
      level: users.xpLevel,
      score: dailyRuns.score,
    })
    .from(dailyRuns)
    .innerJoin(users, eq(users.id, dailyRuns.userId))
    .where(and(...conditions))
    .orderBy(desc(dailyRuns.score), asc(dailyRuns.createdAt))
    .limit(limit);
}
