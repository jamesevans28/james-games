import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { presence, users } from "../db/schema.js";

/**
 * Pure data access for presence rows. Services own the rules (T7.6: only players
 * who switched on `sharePresence` are stored, and friends see only "online").
 */

export type Presence = typeof presence.$inferSelect;

/** The only status stored: no game, no activity detail. */
export const ONLINE_STATUS = "online";

/**
 * Marks the user online now (database clock). Writes nothing and returns null when
 * the user has no row, instead of failing on the foreign key.
 */
export async function upsertOnline(userId: string): Promise<Presence | null> {
  const db = getDb();
  const [row] = await db
    .insert(presence)
    .select(
      db
        .select({
          userId: users.id,
          status: sql<string>`${ONLINE_STATUS}::text`.as("status"),
          gameId: sql<string | null>`null::text`.as("game_id"),
          updatedAt: sql<Date>`now()`.as("updated_at"),
        })
        .from(users)
        .where(eq(users.id, userId)),
    )
    .onConflictDoUpdate({
      target: presence.userId,
      set: { status: sql`excluded.status`, gameId: null, updatedAt: sql`excluded.updated_at` },
    })
    .returning();
  return row ?? null;
}

/** Forgets the user's presence (sharing switched off). */
export async function deletePresence(userId: string): Promise<void> {
  await getDb().delete(presence).where(eq(presence.userId, userId));
}
