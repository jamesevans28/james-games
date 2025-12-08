import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../src/config/aws.js";
import { config } from "../src/config/index.js";
import * as gamesModule from "../../player-web/src/games/index.ts";

const ddb = DynamoDBDocumentClient.from(dynamoClient);

async function run() {
  console.log("Seeding game configs into", config.tables.gameConfigs);

  const gamesExport = (gamesModule as any).games ?? (gamesModule as any).default;
  if (!Array.isArray(gamesExport)) {
    throw new Error("Expected games export to be an array");
  }

  for (const game of gamesExport) {
    const item = {
      gameId: game.id,
      title: game.title,
      description: game.description ?? null,
      objective: game.objective ?? null,
      controls: game.controls ?? null,
      thumbnail: game.thumbnail ?? null,
      xpMultiplier: game.xpMultiplier ?? 1,
      betaOnly: Boolean(game.betaOnly),
      metadata: null,
      createdAt: game.createdAt ?? new Date().toISOString(),
      updatedAt: game.updatedAt ?? new Date().toISOString(),
    };

    console.log("Upserting", item.gameId);
    await ddb.send(
      new PutCommand({
        TableName: config.tables.gameConfigs,
        Item: item,
      })
    );
  }

  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
