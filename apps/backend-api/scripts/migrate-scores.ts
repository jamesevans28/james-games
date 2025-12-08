// Migration script: copy legacy scores into the new scores table shape.
// Usage: run with tsx in the app/ folder, ensuring AWS credentials and env are set.
// Example:
//   SCORES_TABLE=games4james-scores SCORE_GSI_NAME=GameScoresByScore tsx scripts/migrate-scores.ts

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const LEGACY_TABLE = process.env.LEGACY_SCORES_TABLE || "games4james-gamescores";
const TARGET_TABLE = process.env.SCORES_TABLE || "games4james-scores";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Adapt legacy row { gameId, score, name, createdAt } into the new scores schema.
// New table expects PK=gameId and SK=id so we generate a UUID for id.
function adaptLegacy(legacy: any) {
  const id = randomUUID();
  return {
    gameId: legacy.gameId,
    id,
    score: Number(legacy.score || 0),
    createdAt: legacy.createdAt || new Date().toISOString(),
    // These records were created before user profiles existed. Keep the original
    // name in `screenNameSnapshot` so leaderboards can show something useful.
    userId: undefined,
    screenNameSnapshot: legacy.name ? String(legacy.name) : undefined,
    avatarSnapshot: null,
    version: 1,
  };
}

async function main() {
  // Parse CLI args: --limit=N and --dry-run
  const argv = process.argv.slice(2);
  let limit: number | undefined = undefined;
  let dryRun = false;
  for (const a of argv) {
    if (a.startsWith("--limit=")) {
      const v = Number(a.split("=")[1]);
      if (!Number.isNaN(v) && v > 0) limit = v;
    }
    if (a === "--dry-run") dryRun = true;
  }

  console.log(`Migrating from ${LEGACY_TABLE} -> ${TARGET_TABLE}`);
  if (limit) console.log(`Limit set: ${limit} rows`);
  if (dryRun) console.log("Running in dry-run mode (no writes)");

  let lastKey: any | undefined = undefined;
  let moved = 0;
  let scanned = 0;
  do {
    const result = await ddb.send(
      new ScanCommand({ TableName: LEGACY_TABLE, ExclusiveStartKey: lastKey, Limit: 100 })
    );
    const items = result.Items || [];
    for (const row of items) {
      scanned++;
      const item = adaptLegacy(row);
      // Log the first adapted item for verification
      if (scanned === 1) {
        console.log("Sample adapted item:", JSON.stringify(item, null, 2));
      }
      if (!dryRun) {
        await ddb.send(new PutCommand({ TableName: TARGET_TABLE, Item: item }));
      }
      moved++;
      if (moved % 100 === 0) console.log(`Moved ${moved} rows...`);
      if (limit && moved >= limit) break;
    }
    if (limit && moved >= limit) break;
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  console.log(
    `Done. Scanned ${scanned} rows. Migrated ${moved} rows.` + (dryRun ? " (dry-run)" : "")
  );
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
