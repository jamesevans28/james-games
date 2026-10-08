import { and, desc, gt, inArray } from "drizzle-orm";
import { getDb, type Db } from "../db/client.js";
import { authAttempts } from "../db/schema.js";

/** Pure data access for sign-in attempts (T7.7). services/throttle.ts owns the rules. */

export type AttemptRow = { key: string; ok: boolean; attemptedAt: Date };

/**
 * Attempts for these keys newer than `since`, newest first. Capped: a blocked key
 * stops recording failures, so a window never holds many more rows than its limit.
 */
export async function listAttempts(keys: string[], since: Date, cap = 500): Promise<AttemptRow[]> {
  if (keys.length === 0) return [];
  return getDb()
    .select({ key: authAttempts.key, ok: authAttempts.ok, attemptedAt: authAttempts.attemptedAt })
    .from(authAttempts)
    .where(and(inArray(authAttempts.key, keys), gt(authAttempts.attemptedAt, since)))
    .orderBy(desc(authAttempts.attemptedAt))
    .limit(cap);
}

export async function insertAttempts(keys: string[], ok: boolean, at: Date): Promise<void> {
  if (keys.length === 0) return;
  await getDb()
    .insert(authAttempts)
    .values(keys.map((key) => ({ key, ok, attemptedAt: at })));
}

/** Removes every attempt for these keys (account deletion). */
export async function deleteAttempts(db: Db, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await db.delete(authAttempts).where(inArray(authAttempts.key, keys));
}
