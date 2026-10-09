import { and, asc, count, desc, eq, isNull, max } from "drizzle-orm";
import { getDb, type Db } from "../db/client.js";
import { plays, remixes, users } from "../db/schema.js";

/** Pure data access for saved remixes and their boards (T11.2). Services own the rules. */

export type RemixRow = typeof remixes.$inferSelect;

/** A remix with its maker's public name; null when the maker's account is disabled. */
export type RemixWithOwner = RemixRow & { ownerScreenName: string; ownerAvatar: number };

export async function insertRemix(
  db: Db,
  row: { ownerId: string; gameId: string; name: string; knobs: Record<string, number> },
): Promise<RemixRow> {
  const [created] = await db.insert(remixes).values(row).returning();
  return created!;
}

export async function countRemixesByOwner(db: Db, ownerId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(remixes).where(eq(remixes.ownerId, ownerId));
  return Number(row?.n ?? 0);
}

/** One remix by id (any game). */
export async function getRemixById(id: string, db: Db = getDb()): Promise<RemixRow | null> {
  const [row] = await db.select().from(remixes).where(eq(remixes.id, id)).limit(1);
  return row ?? null;
}

/** One remix with its maker's screen name; null when missing or the maker is disabled. */
export async function getRemixWithOwner(
  id: string,
  db: Db = getDb(),
): Promise<RemixWithOwner | null> {
  const [row] = await db
    .select({
      remix: remixes,
      ownerScreenName: users.screenName,
      ownerAvatar: users.avatar,
    })
    .from(remixes)
    .innerJoin(users, eq(users.id, remixes.ownerId))
    .where(and(eq(remixes.id, id), isNull(users.disabledAt)))
    .limit(1);
  return row
    ? { ...row.remix, ownerScreenName: row.ownerScreenName, ownerAvatar: row.ownerAvatar }
    : null;
}

/** A player's own remixes, newest first, optionally for one game. */
export async function listRemixesByOwner(
  ownerId: string,
  opts: { gameId?: string; limit: number },
  db: Db = getDb(),
): Promise<RemixRow[]> {
  const conditions = [eq(remixes.ownerId, ownerId)];
  if (opts.gameId) conditions.push(eq(remixes.gameId, opts.gameId));
  return db
    .select()
    .from(remixes)
    .where(and(...conditions))
    .orderBy(desc(remixes.createdAt))
    .limit(opts.limit);
}

/** The player's best score on a remix so far (0 when they haven't played it). */
export async function bestOnRemix(db: Db, userId: string, remixId: string): Promise<number> {
  const [row] = await db
    .select({ best: max(plays.score) })
    .from(plays)
    .where(and(eq(plays.remixId, remixId), eq(plays.userId, userId)));
  return row?.best ?? 0;
}

export type RemixBoardRow = {
  userId: string;
  screenName: string;
  avatar: number;
  level: number;
  score: number;
  achievedAt: Date;
};

/**
 * A remix's board: each player's best play on it (highest first, earlier wins a
 * tie), public user fields only, disabled and deleted accounts left out.
 */
export async function listRemixLeaderboard(
  remixId: string,
  limit: number,
  db: Db = getDb(),
): Promise<RemixBoardRow[]> {
  const best = db
    .selectDistinctOn([plays.userId], {
      userId: plays.userId,
      score: plays.score,
      achievedAt: plays.createdAt,
    })
    .from(plays)
    .where(eq(plays.remixId, remixId))
    .orderBy(plays.userId, desc(plays.score), asc(plays.createdAt))
    .as("best");
  return db
    .select({
      userId: users.id,
      screenName: users.screenName,
      avatar: users.avatar,
      level: users.xpLevel,
      score: best.score,
      achievedAt: best.achievedAt,
    })
    .from(best)
    .innerJoin(users, eq(users.id, best.userId))
    .where(isNull(users.disabledAt))
    .orderBy(desc(best.score), asc(best.achievedAt))
    .limit(limit);
}
