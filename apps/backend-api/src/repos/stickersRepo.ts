import { and, desc, eq } from "drizzle-orm";
import { getDb, type Db } from "../db/client.js";
import { userStickers } from "../db/schema.js";

/** Pure data access for collected stickers (T7.5). Services own the rules. */

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
