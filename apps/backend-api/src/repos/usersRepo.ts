import { and, count, eq, gte, ne, sql } from "drizzle-orm";
import { getDb, type Db } from "../db/client.js";
import { screenNameHistory, users, type NewUser, type User } from "../db/schema.js";

/** Pure data access for the users table. Services own the rules. */

/** Unique index names on users (see db/schema.ts). Both compare lower-cased values. */
export const USERNAME_KEY = "users_username_lower_key";
export const SCREEN_NAME_KEY = "users_screen_name_lower_key";

/**
 * The unique index a write violated (Postgres 23505), or null for any other error.
 * Drizzle wraps driver errors, so this walks the `cause` chain; postgres-js names the
 * index `constraint_name`, pglite names it `constraint`.
 */
export function uniqueViolation(err: unknown): string | null {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const e = current as { code?: unknown; constraint?: unknown; constraint_name?: unknown };
    if (e.code === "23505") {
      const name = e.constraint_name ?? e.constraint;
      return typeof name === "string" ? name : "unknown";
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export async function getUserById(id: string): Promise<User | null> {
  const [row] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

/** Case-insensitive lookup through users_username_lower_key. */
export async function getUserByUsername(username: string): Promise<User | null> {
  const [row] = await getDb()
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);
  return row ?? null;
}

/**
 * Inserts a user; returns null when the id already exists. Any other unique
 * violation (username, screen name) is thrown for the caller to handle.
 */
export async function insertUser(row: NewUser): Promise<User | null> {
  const [created] = await getDb()
    .insert(users)
    .values(row)
    .onConflictDoNothing({ target: users.id })
    .returning();
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

/** Reads and locks a user row for the rest of the transaction. */
export async function getUserForUpdate(db: Db, id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1).for("update");
  return row ?? null;
}

/** True when another user already has this screen name (case-insensitive). */
export async function isScreenNameTaken(db: Db, name: string, exceptUserId: string) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.screenName}) = lower(${name})`, ne(users.id, exceptUserId)))
    .limit(1);
  return Boolean(row);
}

/** Renames a user and records the change in screen_name_history (call inside a transaction). */
export async function renameUser(
  db: Db,
  user: User,
  newName: string,
  setByUser: boolean,
): Promise<User | null> {
  const [row] = await db
    .update(users)
    .set({ screenName: newName, screenNameSetByUser: setByUser, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();
  if (row) {
    await db
      .insert(screenNameHistory)
      .values({ userId: user.id, oldName: user.screenName, newName });
  }
  return row ?? null;
}

/** How many times the player renamed themselves since `since` (admin resets excluded by the caller's choice of rows). */
export async function countRenamesSince(db: Db, userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(screenNameHistory)
    .where(and(eq(screenNameHistory.userId, userId), gte(screenNameHistory.changedAt, since)));
  return row?.n ?? 0;
}
