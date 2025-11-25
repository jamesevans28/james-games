import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-southeast-2" });
const ddb = DynamoDBDocumentClient.from(client);

async function analyzeScores() {
  const tableName = process.env.SCORES_TABLE || "games4james-scores";

  try {
    const result = await ddb.send(new ScanCommand({ TableName: tableName }));
    const items = result.Items || [];

    const gameStats = {};

    items.forEach((item) => {
      const gameId = item.gameId;
      const score = Number(item.score) || 0;

      if (!gameStats[gameId]) {
        gameStats[gameId] = { scores: [], total: 0, count: 0 };
      }

      gameStats[gameId].scores.push(score);
      gameStats[gameId].total += score;
      gameStats[gameId].count += 1;
    });

    console.log("Game Score Analysis:");
    console.log("===================\n");

    const multipliers = {};

    for (const [gameId, stats] of Object.entries(gameStats)) {
      stats.scores.sort((a, b) => a - b);
      const avg = stats.total / stats.count;
      const median = stats.scores[Math.floor(stats.count / 2)];
      const p90 = stats.scores[Math.floor(stats.count * 0.9)];

      console.log(`Game: ${gameId}`);
      console.log(`  Count: ${stats.count}`);
      console.log(`  Average: ${avg.toFixed(2)}`);
      console.log(`  Median: ${median}`);
      console.log(`  90th percentile: ${p90}`);
      console.log(`  Min: ${stats.scores[0]}`);
      console.log(`  Max: ${stats.scores[stats.count - 1]}`);

      // Calculate multiplier: target ~50 XP for median score
      const multiplier = 50 / median;
      multipliers[gameId] = multiplier;
      console.log(`  Suggested multiplier: ${multiplier.toFixed(4)}`);
      console.log("");
    }

    console.log("\nMultipliers object for games/index.ts:");
    console.log("=======================================");
    console.log(JSON.stringify(multipliers, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

analyzeScores();
