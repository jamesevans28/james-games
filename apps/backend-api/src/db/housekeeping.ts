import { and, lt, notExists, eq, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { authAttempts, plays, presence, users } from "./schema.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily clean-up (T6.9): presence rows and sign-in attempts older than a day, and anonymous players
 * who never finished a run and haven't been seen for 90 days. Returns counts only.
 */
export async function runHousekeeping(db: Db, now = new Date()) {
  const stalePresence = await db
    .delete(presence)
    .where(lt(presence.updatedAt, new Date(now.getTime() - DAY_MS)))
    .returning({ id: presence.userId });

  const staleAttempts = await db
    .delete(authAttempts)
    .where(lt(authAttempts.attemptedAt, new Date(now.getTime() - DAY_MS)))
    .returning({ id: authAttempts.id });

  const cutoff = new Date(now.getTime() - 90 * DAY_MS);
  const idleGuests = await db
    .delete(users)
    .where(
      and(
        eq(users.accountType, "anonymous"),
        lt(sql`coalesce(${users.lastSeenAt}, ${users.createdAt})`, cutoff),
        notExists(
          db
            .select({ one: sql`1` })
            .from(plays)
            .where(eq(plays.userId, users.id)),
        ),
      ),
    )
    .returning({ id: users.id });

  return {
    presenceDeleted: stalePresence.length,
    attemptsDeleted: staleAttempts.length,
    guestsDeleted: idleGuests.length,
  };
}
