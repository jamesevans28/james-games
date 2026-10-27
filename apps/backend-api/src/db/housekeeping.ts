import { and, lt, notExists, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { authAttempts, familyCodes, plays, presence, users } from "./schema.js";
import { deleteAuthUser, listAuthUsers } from "../services/supabaseAuthService.js";
import { log } from "../lib/log.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Most Supabase auth users deleted per run; the rest wait for the next day. */
export const AUTH_DELETE_CAP = 500;
/** Auth users per `listUsers` page, and pages read per run (100,000 users). */
export const AUTH_PAGE_SIZE = 1000;
export const AUTH_MAX_PAGES = 100;
/** Failed deletes before the sweep gives up for the day (a bad key fails every one). */
const AUTH_MAX_FAILURES = 5;
/** Ids per `users` lookup, well under Postgres's parameter limit. */
const LOOKUP_CHUNK = 1000;

export type HousekeepingOptions = {
  /** Off when the Supabase admin key isn't configured; the database half still runs. */
  sweepAuthUsers?: boolean;
};

/**
 * Daily clean-up (T6.9): presence rows and sign-in attempts older than a day, and anonymous players
 * who never finished a run and haven't been seen for 90 days. Then (T14.10) their Supabase auth
 * users, and idle anonymous auth users that never got a row. Returns counts only.
 */
export async function runHousekeeping(
  db: Db,
  now = new Date(),
  { sweepAuthUsers = true }: HousekeepingOptions = {},
) {
  const stalePresence = await db
    .delete(presence)
    .where(lt(presence.updatedAt, new Date(now.getTime() - DAY_MS)))
    .returning({ id: presence.userId });

  const staleAttempts = await db
    .delete(authAttempts)
    .where(lt(authAttempts.attemptedAt, new Date(now.getTime() - DAY_MS)))
    .returning({ id: authAttempts.id });

  await db.delete(familyCodes).where(lt(familyCodes.expiresAt, now));

  const cutoff = new Date(now.getTime() - 90 * DAY_MS);
  const idleGuests = await db
    .delete(users)
    .where(
      and(
        eq(users.accountType, "anonymous"),
        // A raw SQL value isn't typed, so pass the cutoff as text: postgres-js can't
        // serialise a Date here (pglite in the tests can, which hid this).
        lt(
          sql`coalesce(${users.lastSeenAt}, ${users.createdAt})`,
          sql`${cutoff.toISOString()}::timestamptz`,
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(plays)
            .where(eq(plays.userId, users.id)),
        ),
      ),
    )
    .returning({ id: users.id });

  const auth = sweepAuthUsers
    ? await sweepAnonymousAuthUsers(
        db,
        cutoff,
        idleGuests.map((g) => g.id),
      )
    : { authSweep: "skipped" as const };

  return {
    presenceDeleted: stalePresence.length,
    attemptsDeleted: staleAttempts.length,
    guestsDeleted: idleGuests.length,
    ...auth,
  };
}

/**
 * Deletes Supabase auth users that are anonymous and have no `users` row: first those whose
 * row was just deleted, then ones idle since the cutoff (a guest who left before
 * register-anonymous, or whose auth delete failed on an earlier run). Only users the admin
 * API lists with `is_anonymous` are touched, at most AUTH_DELETE_CAP per run.
 */
async function sweepAnonymousAuthUsers(db: Db, cutoff: Date, deletedGuestIds: string[]) {
  // Read every page before deleting anything: deletes would shift later pages under us.
  const idleById = new Map<string, boolean>();
  let complete = false;
  try {
    for (let page = 1; page <= AUTH_MAX_PAGES && !complete; page++) {
      const batch = await listAuthUsers(page, AUTH_PAGE_SIZE);
      for (const u of batch) {
        if (u.isAnonymous) idleById.set(u.id, (u.lastSignInAt ?? u.createdAt) < cutoff);
      }
      complete = batch.length < AUTH_PAGE_SIZE;
    }
  } catch (err) {
    log.warn("db_housekeeping_auth_list_failed", {}, err);
    return { authSweep: "failed" as const };
  }

  // A deleted guest missing from a complete list is already gone. One that isn't
  // anonymous in Supabase is left alone.
  const fromDeletedRows = deletedGuestIds.filter((id) => idleById.has(id));
  const justDeleted = new Set(deletedGuestIds);
  const idle = [...idleById].filter(([id, isIdle]) => isIdle && !justDeleted.has(id));
  const orphans: string[] = [];
  for (let i = 0; i < idle.length && orphans.length < AUTH_DELETE_CAP; i += LOOKUP_CHUNK) {
    const ids = idle.slice(i, i + LOOKUP_CHUNK).map(([id]) => id);
    const withRows = await db.select({ id: users.id }).from(users).where(inArray(users.id, ids));
    const hasRow = new Set(withRows.map((r) => r.id));
    orphans.push(...ids.filter((id) => !hasRow.has(id)));
  }

  const targets = [...fromDeletedRows, ...orphans];
  let guestAuthUsersDeleted = 0;
  let orphanAuthUsersDeleted = 0;
  let authDeleteFailures = 0;
  let attempted = 0;
  for (const id of targets.slice(0, AUTH_DELETE_CAP)) {
    if (authDeleteFailures >= AUTH_MAX_FAILURES) break;
    attempted++;
    try {
      await deleteAuthUser(id);
      if (attempted <= fromDeletedRows.length) guestAuthUsersDeleted++;
      else orphanAuthUsersDeleted++;
    } catch (err) {
      // The first error says why (code only); the rest would say the same.
      if (authDeleteFailures === 0) log.warn("db_housekeeping_auth_delete_failed", {}, err);
      authDeleteFailures++;
    }
  }

  return {
    authSweep: complete ? ("complete" as const) : ("truncated" as const),
    guestAuthUsersDeleted,
    orphanAuthUsersDeleted,
    authDeleteFailures,
    /** Found but not tried this run (a lower bound once the cap is reached). */
    authUsersLeft: targets.length - attempted,
  };
}
