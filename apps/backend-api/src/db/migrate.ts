/**
 * `npm run db:migrate -w apps/backend-api`: applies drizzle/*.sql. Uses the session
 * pooler (DATABASE_URL_MIGRATIONS, port 5432); the transaction pooler can't run DDL
 * in one session.
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL_MIGRATIONS;
if (!url) throw new Error("DATABASE_URL_MIGRATIONS is not set (see apps/backend-api/.env.example)");
const client = postgres(url, { max: 1, onnotice: () => {} });
await migrate(drizzle(client), {
  migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle"),
});
await client.end();
console.log("Migrations applied.");
