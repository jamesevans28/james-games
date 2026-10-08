import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users, type NewUser, type User } from "../db/schema.js";

/** Pure data access for the users table. Services own the rules. */
export async function getUserById(id: string): Promise<User | null> {
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/** Inserts a user; returns null when the id already exists. */
export async function insertUser(row: NewUser): Promise<User | null> {
  const [created] = await getDb().insert(users).values(row).onConflictDoNothing().returning();
  return created ?? null;
}

export async function updateUser(
  id: string,
  patch: Partial<Omit<NewUser, "id" | "createdAt">>,
): Promise<User | null> {
  const [row] = await getDb()
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return row ?? null;
}
