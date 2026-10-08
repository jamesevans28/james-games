/**
 * In-process Postgres for tests (pglite): the real schema and migrations, no
 * server, about 1 s to start. Each call gives a fresh, empty, seeded database.
 *
 *   const db = await createTestDb();   // also installs it as getDb()
 */
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { setDb, type Db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { seedDatabase, type ManifestRow } from "../db/seedData.js";

export const TEST_GAMES: ManifestRow[] = [
  {
    id: "test-game",
    title: "Test Game",
    status: "active",
    scoring: { max: 1000, perSecondMax: 50, xpMultiplier: 1 },
  },
  {
    id: "beta-game",
    title: "Beta Game",
    status: "beta",
    scoring: { max: 1000, perSecondMax: 50, xpMultiplier: 2 },
  },
  {
    id: "old-game",
    title: "Old Game",
    status: "inactive",
    scoring: { max: 1000, perSecondMax: 50, xpMultiplier: 1 },
  },
];

export async function createTestDb(manifests: ManifestRow[] = TEST_GAMES): Promise<Db> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle") });
  const typed = db as unknown as Db;
  await seedDatabase(typed, manifests);
  setDb(typed);
  return typed;
}
