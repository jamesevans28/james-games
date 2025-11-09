// Migration script: copy legacy scores into the new scores table shape.
// Usage: run with tsx in the app/ folder, ensuring AWS credentials and env are set.
// Example:
//   SCORES_TABLE=games4james-scores SCORE_GSI_NAME=GameScoresByScore tsx scripts/migrate-scores.ts

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const LEGACY_TABLE = process.env.LEGACY_SCORES_TABLE || "games4james-gamescores";
const TARGET_TABLE = process.env.SCORES_TABLE || "games4james-scores";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Minimal adapt for legacy row { gameId, score, name, createdAt }
function adaptLegacy(legacy: any) {
  return {
    gameId: legacy.gameId,
    score: Number(legacy.score || 0),
    createdAt: legacy.createdAt || new Date().toISOString(),
    legacyName: legacy.name ? String(legacy.name) : undefined,
    version: 1,
  };
}

async function main() {
  console.log(`Migrating from ${LEGACY_TABLE} -> ${TARGET_TABLE}`);
  let lastKey: any | undefined = undefined;
  let moved = 0;
  do {
    const result = await ddb.send(
      new ScanCommand({ TableName: LEGACY_TABLE, ExclusiveStartKey: lastKey, Limit: 100 })
    );
    const items = result.Items || [];
    for (const row of items) {
      const item = adaptLegacy(row);
      await ddb.send(new PutCommand({ TableName: TARGET_TABLE, Item: item }));
      moved++;
      if (moved % 100 === 0) console.log(`Moved ${moved} rows...`);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  console.log(`Done. Migrated ${moved} rows.`);
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
