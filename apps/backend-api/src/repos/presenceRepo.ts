import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { games, presence, users } from "../db/schema.js";

/** Pure data access for presence rows. Services own the rules. */

export type Presence = typeof presence.$inferSelect;

/**
 * Upserts the user's presence with the database clock as `updated_at`. Writes
 * nothing (and returns null) when the user has no row, instead of failing on the
 * foreign key.
 */
export async function upsertPresence(
  userId: string,
  status: string,
  gameId: string | null,
): Promise<Presence | null> {
  const db = getDb();
  const [row] = await db
    .insert(presence)
    .select(
      db
        .select({
          userId: users.id,
          status: sql<string>`${status}::text`.as("status"),
          gameId: sql<string | null>`${gameId}::text`.as("game_id"),
          updatedAt: sql<Date>`now()`.as("updated_at"),
        })
        .from(users)
        .where(eq(users.id, userId)),
    )
    .onConflictDoUpdate({
      target: presence.userId,
      set: {
        status: sql`excluded.status`,
        gameId: sql`excluded.game_id`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    .returning();
  return row ?? null;
}

/** True when a game with this id exists (any status). */
export async function gameExists(gameId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: games.id })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  return Boolean(row);
}
