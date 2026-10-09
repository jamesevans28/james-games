import { and, count, countDistinct, desc, eq, sql } from "drizzle-orm";
import { getDb, type Db } from "../db/client.js";
import { plays, userStickers } from "../db/schema.js";

/** Pure data access for collected stickers (T7.5, T11.4). Services own the rules. */

export type StickerRow = { stickerId: string; earnedAt: Date };

export async function hasSticker(db: Db, userId: string, stickerId: string): Promise<boolean> {
  const [row] = await db
    .select({ stickerId: userStickers.stickerId })
    .from(userStickers)
    .where(and(eq(userStickers.userId, userId), eq(userStickers.stickerId, stickerId)))
    .limit(1);
  return Boolean(row);
}

/** Adds a sticker once. Returns true only when this call collected it. */
export async function awardSticker(
  db: Db,
  row: { userId: string; stickerId: string; earnedAt: Date },
): Promise<boolean> {
  const inserted = await db
    .insert(userStickers)
    .values(row)
    .onConflictDoNothing({ target: [userStickers.userId, userStickers.stickerId] })
    .returning({ stickerId: userStickers.stickerId });
  return inserted.length > 0;
}

/** A player's stickers, newest first. */
export async function listStickers(userId: string, db: Db = getDb()): Promise<StickerRow[]> {
  return db
    .select({ stickerId: userStickers.stickerId, earnedAt: userStickers.earnedAt })
    .from(userStickers)
    .where(eq(userStickers.userId, userId))
    .orderBy(desc(userStickers.earnedAt), desc(userStickers.stickerId));
}

/** The ids a player already has, for skipping rules that are already collected. */
export async function listStickerIds(db: Db, userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ stickerId: userStickers.stickerId })
    .from(userStickers)
    .where(eq(userStickers.userId, userId));
  return new Set(rows.map((r) => r.stickerId));
}

/**
 * Play counts for the sticker rules (T11.4): all plays, different games tried,
 * and plays of one game. Read after the run's play is inserted, so it counts.
 */
export async function countPlaysFor(
  db: Db,
  userId: string,
  gameId: string,
): Promise<{ total: number; games: number; thisGame: number }> {
  const [row] = await db
    .select({
      total: count(),
      games: countDistinct(plays.gameId),
      thisGame: sql<number>`count(*) filter (where ${plays.gameId} = ${gameId})`.mapWith(Number),
    })
    .from(plays)
    .where(eq(plays.userId, userId));
  return {
    total: Number(row?.total ?? 0),
    games: Number(row?.games ?? 0),
    thisGame: Number(row?.thisGame ?? 0),
  };
}
