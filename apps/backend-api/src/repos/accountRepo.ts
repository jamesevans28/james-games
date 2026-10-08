import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { users, type User } from "../db/schema.js";

/**
 * Deletes the user row (T7.8). Foreign keys do the rest: plays keep the score
 * with user_id set to null; best scores, stats, ratings, follows, blocks,
 * stickers, presence and screen-name history cascade away.
 */
export async function deleteUserRow(db: Db, id: string): Promise<User | null> {
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
  return deleted ?? null;
}
