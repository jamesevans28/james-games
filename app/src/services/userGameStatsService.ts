// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";

const ddb = DynamoDBDocumentClient.from(dynamoClient);
const USER_RECENT_INDEX = config.tables.userRecentGamesIndex || "UserRecentGames";
const GAME_STATS_INDEX = config.tables.gameStatsByGameIndex || "GameStatsByGame";

export type UserGameStat = {
  userId: string;
  gameId: string;
  bestScore?: number;
  lastScore?: number;
  lastPlayedAt?: string;
};

/**
 * Record a play session for (user, game). Updates last score/time and best score when applicable.
 */
export async function recordUserGameSession(userId: string, gameId: string, score: number) {
  if (!config.tables.userGameStats) return;
  const nowIso = new Date().toISOString();
  const recentKey = `${nowIso}#${gameId}`;
  const updateResult = await ddb.send(
    new UpdateCommand({
      TableName: config.tables.userGameStats,
      Key: { userId, gameId },
      UpdateExpression:
        "SET lastScore = :s, lastPlayedAt = :now, recentKey = :rk, createdAt = if_not_exists(createdAt, :now)",
      ExpressionAttributeValues: {
        ":s": score,
        ":now": nowIso,
        ":rk": recentKey,
      },
      ReturnValues: "ALL_NEW",
    })
  );
  const previousBest = Number(updateResult.Attributes?.bestScore ?? 0);
  if (!previousBest || score > previousBest) {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: config.tables.userGameStats,
          Key: { userId, gameId },
          UpdateExpression: "SET bestScore = :s",
          ConditionExpression: "attribute_not_exists(bestScore) OR bestScore < :s",
          ExpressionAttributeValues: { ":s": score },
        })
      );
    } catch (err: any) {
      if (err?.name !== "ConditionalCheckFailedException") throw err;
    }
  }
}

export async function getRecentGamesForUser(userId: string, limit = 5): Promise<UserGameStat[]> {
  if (!config.tables.userGameStats) return [];
  const res = await ddb.send(
    new QueryCommand({
      TableName: config.tables.userGameStats,
      IndexName: USER_RECENT_INDEX,
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": userId },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return (res.Items || []) as UserGameStat[];
}

export async function getStatsForGame(gameId: string, limit = 50): Promise<UserGameStat[]> {
  if (!config.tables.userGameStats) return [];
  const res = await ddb.send(
    new QueryCommand({
      TableName: config.tables.userGameStats,
      IndexName: GAME_STATS_INDEX,
      KeyConditionExpression: "gameId = :g",
      ExpressionAttributeValues: { ":g": gameId },
      Limit: limit,
    })
  );
  return (res.Items || []) as UserGameStat[];
}
