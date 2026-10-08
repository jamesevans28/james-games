/** `npm run db:seed -w apps/backend-api`: games from the exported manifests, plus XP levels. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "./client.js";
import { seedDatabase, type ManifestRow } from "./seedData.js";

const metaPath = path.resolve(import.meta.dirname, "../../../player-web/public/game-meta.json");
const manifests = JSON.parse(readFileSync(metaPath, "utf8")) as ManifestRow[];
await seedDatabase(getDb(), manifests);
console.log(`Seeded ${manifests.length} games and the XP levels.`);
process.exit(0);
