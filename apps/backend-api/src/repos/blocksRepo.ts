import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../db/client.js";
import { blocks, follows, users } from "../db/schema.js";

/** Pure data access for blocks (T7.6). Services own the rules. */

/**
 * SQL that is true when either player has blocked the other. For use inside other
 * queries (friends lists, the friends leaderboard) so a blocked pair never sees each other.
 */
export function blockedEitherWay(a: AnyPgColumn | string, b: AnyPgColumn | string): SQL {
  return sql`exists (select 1 from ${blocks} where (${blocks.userId} = ${a} and ${blocks.blockedUserId} = ${b}) or (${blocks.userId} = ${b} and ${blocks.blockedUserId} = ${a}))`;
}

/** True when either player has blocked the other. */
export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ userId: blocks.userId })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.userId, a), eq(blocks.blockedUserId, b)),
        and(eq(blocks.userId, b), eq(blocks.blockedUserId, a)),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Records the block and deletes every follow edge between the two players (pending
 * or accepted, both ways) in one transaction. Blocking twice is harmless.
 */
export async function insertBlock(userId: string, blockedUserId: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.insert(blocks).values({ userId, blockedUserId }).onConflictDoNothing();
    await tx
      .delete(follows)
      .where(
        or(
          and(eq(follows.userId, userId), eq(follows.targetUserId, blockedUserId)),
          and(eq(follows.userId, blockedUserId), eq(follows.targetUserId, userId)),
        ),
      );
  });
}

/** Removes the block `userId` placed (never one the other player placed). */
export async function deleteBlock(userId: string, blockedUserId: string): Promise<boolean> {
  const rows = await getDb()
    .delete(blocks)
    .where(and(eq(blocks.userId, userId), eq(blocks.blockedUserId, blockedUserId)))
    .returning({ userId: blocks.userId });
  return rows.length > 0;
}

export type BlockedRow = { userId: string; screenName: string; avatar: number; blockedAt: Date };

/** The players `userId` has blocked, newest first (public fields only, for the unblock list). */
export function listBlockedRows(userId: string): Promise<BlockedRow[]> {
  return getDb()
    .select({
      userId: users.id,
      screenName: users.screenName,
      avatar: users.avatar,
      blockedAt: blocks.createdAt,
    })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedUserId))
    .where(eq(blocks.userId, userId))
    .orderBy(desc(blocks.createdAt), users.id);
}
