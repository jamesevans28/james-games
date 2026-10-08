import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "../db/client.js";
import { follows, presence, users } from "../db/schema.js";
import { blockedEitherWay } from "./blocksRepo.js";

/**
 * Pure data access for friendships (T7.6). Services own the rules.
 *
 * A friend request is one `pending` edge from the asker to the other player.
 * Accepting turns it `accepted` and adds the reverse `accepted` edge, so two
 * players are friends exactly when both edges are accepted.
 */

export type Follow = typeof follows.$inferSelect;

/** How long a presence row counts as online (older than 2 minutes = offline). */
export const PRESENCE_ONLINE_WINDOW = sql`interval '2 minutes'`;

/** The other player on a friendship or request, public fields only. */
export type FriendRow = {
  userId: string;
  screenName: string;
  avatar: number;
  xpLevel: number;
  /** When the friendship (or request) started. */
  since: Date;
  /**
   * Fresh presence AND the player has chosen to share it. Always false for requests.
   * Decided by the database clock.
   */
  online: boolean;
};

const reverse = alias(follows, "reverse");

/** Presence is fresh and the player still has sharing switched on. */
const sharedOnline = sql<boolean>`coalesce(${presence.updatedAt} > now() - ${PRESENCE_ONLINE_WINDOW} and ${users.prefs}->>'sharePresence' = 'true', false)`;

/** `userId`'s friends (accepted both ways, not blocked), newest friendship first. */
export async function listFriendRows(userId: string): Promise<FriendRow[]> {
  const rows = await getDb()
    .select({
      userId: users.id,
      screenName: users.screenName,
      avatar: users.avatar,
      xpLevel: users.xpLevel,
      since: sql<Date>`greatest(${follows.createdAt}, ${reverse.createdAt})`.mapWith(
        follows.createdAt,
      ),
      online: sharedOnline,
    })
    .from(follows)
    .innerJoin(
      reverse,
      and(
        eq(reverse.userId, follows.targetUserId),
        eq(reverse.targetUserId, follows.userId),
        eq(reverse.status, "accepted"),
      ),
    )
    .innerJoin(users, eq(users.id, follows.targetUserId))
    .leftJoin(presence, eq(presence.userId, users.id))
    .where(
      and(
        eq(follows.userId, userId),
        eq(follows.status, "accepted"),
        sql`not ${blockedEitherWay(follows.userId, follows.targetUserId)}`,
      ),
    )
    .orderBy(desc(sql`greatest(${follows.createdAt}, ${reverse.createdAt})`), users.id);
  return rows.map((row) => ({ ...row, online: Boolean(row.online) }));
}

/**
 * Pending requests: "incoming" were sent to `userId`, "outgoing" were sent by them.
 * Newest first; blocked pairs are left out.
 */
export async function listRequestRows(
  userId: string,
  side: "incoming" | "outgoing",
): Promise<FriendRow[]> {
  const mine = side === "incoming" ? follows.targetUserId : follows.userId;
  const other = side === "incoming" ? follows.userId : follows.targetUserId;
  const rows = await getDb()
    .select({
      userId: users.id,
      screenName: users.screenName,
      avatar: users.avatar,
      xpLevel: users.xpLevel,
      since: follows.createdAt,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, other))
    .where(
      and(
        eq(mine, userId),
        eq(follows.status, "pending"),
        sql`not ${blockedEitherWay(follows.userId, follows.targetUserId)}`,
      ),
    )
    .orderBy(desc(follows.createdAt), users.id);
  return rows.map((row) => ({ ...row, online: false }));
}

/** The edges between two players, each way. */
export async function getEdgesBetween(
  userId: string,
  otherId: string,
): Promise<{ outgoing: Follow | null; incoming: Follow | null }> {
  const rows = await getDb()
    .select()
    .from(follows)
    .where(
      or(
        and(eq(follows.userId, userId), eq(follows.targetUserId, otherId)),
        and(eq(follows.userId, otherId), eq(follows.targetUserId, userId)),
      ),
    );
  return {
    outgoing: rows.find((r) => r.userId === userId) ?? null,
    incoming: rows.find((r) => r.userId === otherId) ?? null,
  };
}

/** Inserts a pending request; returns null when an edge already exists. */
export async function insertRequest(userId: string, targetUserId: string): Promise<Follow | null> {
  const [row] = await getDb()
    .insert(follows)
    .values({ userId, targetUserId, status: "pending" })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

/**
 * Accepts the pending request from `requesterId` to `userId`: marks it accepted and
 * adds (or accepts) the reverse edge, in one transaction. False when there was no
 * pending request.
 */
export async function acceptRequest(userId: string, requesterId: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const accepted = await tx
      .update(follows)
      .set({ status: "accepted", createdAt: sql`now()` })
      .where(
        and(
          eq(follows.userId, requesterId),
          eq(follows.targetUserId, userId),
          eq(follows.status, "pending"),
        ),
      )
      .returning({ userId: follows.userId });
    if (!accepted.length) return false;
    await tx
      .insert(follows)
      .values({ userId, targetUserId: requesterId, status: "accepted" })
      .onConflictDoUpdate({
        target: [follows.userId, follows.targetUserId],
        set: { status: "accepted", createdAt: sql`now()` },
      });
    return true;
  });
}

/** Deletes pending edges between two players, either way. Returns how many went. */
export async function deletePendingBetween(userId: string, otherId: string): Promise<number> {
  const rows = await getDb()
    .delete(follows)
    .where(
      and(
        eq(follows.status, "pending"),
        or(
          and(eq(follows.userId, userId), eq(follows.targetUserId, otherId)),
          and(eq(follows.userId, otherId), eq(follows.targetUserId, userId)),
        ),
      ),
    )
    .returning({ userId: follows.userId });
  return rows.length;
}

/** Deletes every edge between two players, both ways (ends a friendship). */
export async function deleteEdgesBetween(userId: string, otherId: string): Promise<number> {
  const rows = await getDb()
    .delete(follows)
    .where(
      or(
        and(eq(follows.userId, userId), eq(follows.targetUserId, otherId)),
        and(eq(follows.userId, otherId), eq(follows.targetUserId, userId)),
      ),
    )
    .returning({ userId: follows.userId });
  return rows.length;
}

/** The user id behind a friend code (already normalised), or null. */
export async function findUserIdByFriendCode(code: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.friendCode, code))
    .limit(1);
  return row?.id ?? null;
}
