#!/usr/bin/env node
// Migration script (JS): copy legacy scores into the new scores table shape.
// Usage: run with node in the app/ folder, ensuring AWS credentials and env are set.
// Example:
//   SCORES_TABLE=games4james-scores LEGACY_SCORES_TABLE=games4james-gamescores node scripts/migrate-scores.js --limit=1

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const LEGACY_TABLE = process.env.LEGACY_SCORES_TABLE || "games4james-gamescores";
const TARGET_TABLE = process.env.SCORES_TABLE || "games4james-scores";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function adaptLegacy(legacy) {
  const id = randomUUID();
  return {
    gameId: legacy.gameId,
    id,
    score: Number(legacy.score || 0),
    createdAt: legacy.createdAt || new Date().toISOString(),
    userId: undefined,
    screenNameSnapshot: legacy.name ? String(legacy.name) : undefined,
    avatarSnapshot: null,
    version: 1,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  let limit;
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

  let lastKey = undefined;
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
      if (scanned === 1) console.log("Sample adapted item:", JSON.stringify(item, null, 2));
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
