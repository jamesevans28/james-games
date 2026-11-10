import { test, expect } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "../test/db.js";

/**
 * Supabase's Data API exposes the public schema to anyone holding the publishable key
 * (it ships in the web app). Only the API, as the postgres role, may touch these tables,
 * so every table needs row security on with no policies (migration 0004). A new table
 * must enable it in its own migration, or this fails.
 */
test("every table in the public schema has row security on", async () => {
  const db = await createTestDb();
  const result = await db.execute(
    sql`select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
        and c.relname not like '__drizzle%'`,
  );
  const rows =
    (result as unknown as { rows?: { name: string }[] }).rows ??
    (result as unknown as { name: string }[]);
  expect(rows.map((r) => r.name)).toEqual([]);

  const all = await db.execute(
    sql`select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity`,
  );
  const allRows =
    (all as unknown as { rows?: { n: number }[] }).rows ?? (all as unknown as { n: number }[]);
  expect(allRows[0]!.n).toBeGreaterThanOrEqual(18);
});
