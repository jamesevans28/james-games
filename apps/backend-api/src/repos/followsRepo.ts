import { and, count, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { follows, games, presence, users } from "../db/schema.js";

/** Pure data access for follow edges. Services own the rules. */

export type Follow = typeof follows.$inferSelect;

/** How long a presence row counts as online (schema: older than 2 minutes = offline). */
export const PRESENCE_ONLINE_WINDOW = sql`interval '2 minutes'`;

/**
 * The person on the other end of an edge, joined from users, with their presence
 * (and the game title from games) when they have reported any. Public fields only.
 */
export type FollowListRow = {
  userId: string;
  screenName: string;
  avatar: number;
  xpLevel: number;
  xpProgress: number;
  xpTotal: number;
  followedAt: Date;
  presenceStatus: string | null;
  presenceGameId: string | null;
  presenceGameTitle: string | null;
  presenceUpdatedAt: Date | null;
  /** Computed by the database clock: presence updated within the online window. */
  online: boolean;
};

export type FollowListOptions = {
  /** Only people whose presence is fresh. */
  onlineOnly?: boolean;
  /** Only people whose presence is in this game. */
  gameId?: string;
  /** Only people whose presence status is one of these. */
  statuses?: string[];
  limit?: number;
};

const onlineExpr = sql<boolean>`coalesce(${presence.updatedAt} > now() - ${PRESENCE_ONLINE_WINDOW}, false)`;

async function listEdges(
  side: "following" | "followers",
  userId: string,
  opts: FollowListOptions,
): Promise<FollowListRow[]> {
  // "following": I am follows.userId, the other person is the target. "followers": the reverse.
  const mine = side === "following" ? follows.userId : follows.targetUserId;
  const other = side === "following" ? follows.targetUserId : follows.userId;
  const where: SQL[] = [eq(mine, userId), eq(follows.status, "accepted")];
  if (opts.onlineOnly) where.push(gt(presence.updatedAt, sql`now() - ${PRESENCE_ONLINE_WINDOW}`));
  if (opts.gameId) where.push(eq(presence.gameId, opts.gameId));
  if (opts.statuses?.length) where.push(inArray(presence.status, opts.statuses));

  const query = getDb()
    .select({
      userId: users.id,
      screenName: users.screenName,
      avatar: users.avatar,
      xpLevel: users.xpLevel,
      xpProgress: users.xpProgress,
      xpTotal: users.xpTotal,
      followedAt: follows.createdAt,
      presenceStatus: presence.status,
      presenceGameId: presence.gameId,
      presenceGameTitle: games.title,
      presenceUpdatedAt: presence.updatedAt,
      online: onlineExpr,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, other))
    .leftJoin(presence, eq(presence.userId, users.id))
    .leftJoin(games, eq(games.id, presence.gameId))
    .where(and(...where))
    .orderBy(desc(follows.createdAt), users.id);
  const rows = opts.limit ? await query.limit(opts.limit) : await query;
  return rows.map((row) => ({ ...row, online: Boolean(row.online) }));
}

/** People `userId` follows (accepted edges), newest first. One join query. */
export function listFollowingRows(userId: string, opts: FollowListOptions = {}) {
  return listEdges("following", userId, opts);
}

/** People following `userId` (accepted edges), newest first. One join query. */
export function listFollowerRows(userId: string, opts: FollowListOptions = {}) {
  return listEdges("followers", userId, opts);
}

/** Inserts an accepted edge; returns null when the edge already exists. */
export async function insertFollow(userId: string, targetUserId: string): Promise<Follow | null> {
  const [row] = await getDb()
    .insert(follows)
    .values({ userId, targetUserId, status: "accepted" })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

/** Deletes an edge; returns true when one was removed. */
export async function deleteFollow(userId: string, targetUserId: string): Promise<boolean> {
  const rows = await getDb()
    .delete(follows)
    .where(and(eq(follows.userId, userId), eq(follows.targetUserId, targetUserId)))
    .returning({ userId: follows.userId });
  return rows.length > 0;
}

export async function acceptedFollowExists(userId: string, targetUserId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ userId: follows.userId })
    .from(follows)
    .where(
      and(
        eq(follows.userId, userId),
        eq(follows.targetUserId, targetUserId),
        eq(follows.status, "accepted"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function listFollowingIdRows(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ targetUserId: follows.targetUserId })
    .from(follows)
    .where(and(eq(follows.userId, userId), eq(follows.status, "accepted")));
  return rows.map((row) => row.targetUserId);
}

export async function countFollowingRows(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(follows)
    .where(and(eq(follows.userId, userId), eq(follows.status, "accepted")));
  return row?.n ?? 0;
}

export async function countFollowerRows(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(follows)
    .where(and(eq(follows.targetUserId, userId), eq(follows.status, "accepted")));
  return row?.n ?? 0;
}
