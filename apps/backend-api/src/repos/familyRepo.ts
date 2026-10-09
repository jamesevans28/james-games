import { and, asc, count, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb, type Db } from "../db/client.js";
import { familyCodes, familyLinks, plays, users } from "../db/schema.js";

/** Pure data access for family links (T11.7). services/familyService.ts owns the rules. */

/** Another account in the family, public fields only. */
export type FamilyMemberRow = { userId: string; screenName: string; avatar: number; since: Date };

/** Swaps the grown-up's code for a new one. False when the code is already taken (retry). */
export async function replaceCode(
  db: Db,
  parentUserId: string,
  code: string,
  expiresAt: Date,
): Promise<boolean> {
  await db.delete(familyCodes).where(eq(familyCodes.parentUserId, parentUserId));
  const inserted = await db
    .insert(familyCodes)
    .values({ code, parentUserId, expiresAt })
    .onConflictDoNothing({ target: familyCodes.code })
    .returning({ code: familyCodes.code });
  return inserted.length > 0;
}

export async function findCode(
  db: Db,
  code: string,
): Promise<{ parentUserId: string; expiresAt: Date } | null> {
  const [row] = await db
    .select({ parentUserId: familyCodes.parentUserId, expiresAt: familyCodes.expiresAt })
    .from(familyCodes)
    .where(eq(familyCodes.code, code))
    .limit(1);
  return row ?? null;
}

export async function deleteCode(db: Db, code: string): Promise<void> {
  await db.delete(familyCodes).where(eq(familyCodes.code, code));
}

export async function listParentIds(db: Db, childUserId: string): Promise<string[]> {
  const rows = await db
    .select({ id: familyLinks.parentUserId })
    .from(familyLinks)
    .where(eq(familyLinks.childUserId, childUserId));
  return rows.map((r) => r.id);
}

export async function isLinked(db: Db, parentUserId: string, childUserId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(familyLinks)
    .where(
      and(eq(familyLinks.parentUserId, parentUserId), eq(familyLinks.childUserId, childUserId)),
    );
  return (row?.n ?? 0) > 0;
}

export async function insertLink(db: Db, parentUserId: string, childUserId: string) {
  await db.insert(familyLinks).values({ parentUserId, childUserId }).onConflictDoNothing();
}

/** True when a link was removed. */
export async function deleteLink(
  parentUserId: string,
  childUserId: string,
  db: Db = getDb(),
): Promise<boolean> {
  const removed = await db
    .delete(familyLinks)
    .where(
      and(eq(familyLinks.parentUserId, parentUserId), eq(familyLinks.childUserId, childUserId)),
    )
    .returning({ id: familyLinks.childUserId });
  return removed.length > 0;
}

export async function getMember(
  db: Db,
  userId: string,
): Promise<Omit<FamilyMemberRow, "since"> | null> {
  const [row] = await db
    .select({ userId: users.id, screenName: users.screenName, avatar: users.avatar })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

/** The kids this grown-up is linked to, oldest link first. */
export async function listKids(parentUserId: string, db: Db = getDb()): Promise<FamilyMemberRow[]> {
  return db
    .select({
      userId: users.id,
      screenName: users.screenName,
      avatar: users.avatar,
      since: familyLinks.createdAt,
    })
    .from(familyLinks)
    .innerJoin(users, eq(users.id, familyLinks.childUserId))
    .where(eq(familyLinks.parentUserId, parentUserId))
    .orderBy(asc(familyLinks.createdAt));
}

/** The grown-ups linked to this kid, oldest link first. */
export async function listGrownUps(
  childUserId: string,
  db: Db = getDb(),
): Promise<FamilyMemberRow[]> {
  return db
    .select({
      userId: users.id,
      screenName: users.screenName,
      avatar: users.avatar,
      since: familyLinks.createdAt,
    })
    .from(familyLinks)
    .innerJoin(users, eq(users.id, familyLinks.parentUserId))
    .where(eq(familyLinks.childUserId, childUserId))
    .orderBy(asc(familyLinks.createdAt));
}

export type DayPlayRow = { userId: string; day: string; plays: number; durationMs: number };

/**
 * Plays and summed duration per player per local day since `fromUtc`. The local day
 * is the play's time shifted by `tzOffsetMinutes` (minutes east of UTC, clamped by
 * the caller).
 */
export async function playTimeByDay(
  userIds: string[],
  fromUtc: Date,
  tzOffsetMinutes: number,
  db: Db = getDb(),
): Promise<DayPlayRow[]> {
  if (userIds.length === 0) return [];
  // Inlined (not a parameter) so the select and GROUP BY are the same expression.
  // Safe: forced to an integer here, and the service has already clamped it.
  const mins = sql.raw(String(Math.trunc(tzOffsetMinutes) || 0));
  const day = sql<string>`to_char((${plays.createdAt} at time zone 'UTC') + make_interval(mins => ${mins}), 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      userId: sql<string>`${plays.userId}`,
      day,
      plays: count(),
      durationMs: sql<string>`coalesce(sum(${plays.durationMs}), 0)`,
    })
    .from(plays)
    .where(and(inArray(plays.userId, userIds), gte(plays.createdAt, fromUtc)))
    .groupBy(plays.userId, day);
  return rows.map((r) => ({
    userId: r.userId,
    day: r.day,
    plays: Number(r.plays),
    durationMs: Number(r.durationMs),
  }));
}
