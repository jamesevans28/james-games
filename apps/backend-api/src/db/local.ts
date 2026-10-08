/**
 * Local stack only (npm run local): a Postgres on disk via pglite, so the API runs
 * with no Supabase project. Migrations and the seed run on every start.
 * Never imported by the Lambda (dev-server.ts loads it dynamically).
 */
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { setDb, type Db } from "./client.js";
import * as schema from "./schema.js";
import { seedDatabase, type ManifestRow } from "./seedData.js";

export async function useLocalDatabase(dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const db = drizzle(new PGlite(dir), { schema });
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle") });
  const metaPath = path.resolve(import.meta.dirname, "../../../player-web/public/game-meta.json");
  const manifests = JSON.parse(readFileSync(metaPath, "utf8")) as ManifestRow[];
  const typed = db as unknown as Db;
  await seedDatabase(typed, manifests);
  setDb(typed);
}
