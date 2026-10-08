import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema.js";

/** Any Drizzle Postgres database with our schema (postgres-js in the API, pglite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Db | null = null;

/**
 * The shared database handle. On Lambda this connects through the Supabase
 * transaction pooler (DATABASE_URL, port 6543), which needs `prepare: false`;
 * one connection per container is plenty.
 */
export function getDb(): Db {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see apps/backend-api/.env.example)");
  const client = postgres(url, { prepare: false, max: 1, idle_timeout: 20 });
  db = drizzle(client, { schema });
  return db;
}

/** Tests swap in an in-process pglite database (src/test/db.ts). */
export function setDb(next: Db | null): void {
  db = next;
}

export { schema };
