import { and, eq, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { getDb, type Db } from "../db/client.js";
import { familyLinks, supporters } from "../db/schema.js";

type SupporterSource = (typeof supporters.$inferInsert)["source"];

/** Records a supporter once. Returns true only when this call added them. */
export async function grantSupporter(
  db: Db,
  row: { userId: string; source: SupporterSource; externalId: string },
): Promise<boolean> {
  const inserted = await db
    .insert(supporters)
    .values(row)
    .onConflictDoNothing()
    .returning({ userId: supporters.userId });
  return inserted.length > 0;
}

export async function revokeSupporter(userId: string): Promise<boolean> {
  const removed = await getDb()
    .delete(supporters)
    .where(eq(supporters.userId, userId))
    .returning({ userId: supporters.userId });
  return removed.length > 0;
}

/**
 * SQL condition: the user (by column) is a supporter, or a grown-up linked to them
 * through the family is (perks reach the whole family, T12.2).
 */
export function supporterCondition(userIdColumn: AnyPgColumn): SQL {
  return sql`exists (
    select 1 from ${supporters}
    where ${supporters.userId} = ${userIdColumn}
       or ${supporters.userId} in (
         select ${familyLinks.parentUserId} from ${familyLinks}
         where ${familyLinks.childUserId} = ${userIdColumn}
       )
  )`;
}

export async function isSupporter(userId: string, db: Db = getDb()): Promise<boolean> {
  const [own] = await db
    .select({ userId: supporters.userId })
    .from(supporters)
    .leftJoin(familyLinks, eq(familyLinks.parentUserId, supporters.userId))
    .where(or(eq(supporters.userId, userId), and(eq(familyLinks.childUserId, userId))))
    .limit(1);
  return Boolean(own);
}
