// eslint-disable-next-line @typescript-eslint/no-explicit-any

import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
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

/** Stats rows for one game and a set of users (direct key lookups, 100 per batch). */
export async function getStatsForUsers(gameId: string, userIds: string[]): Promise<UserGameStat[]> {
  const table = config.tables.userGameStats;
  if (!table || userIds.length === 0) return [];
  const unique = Array.from(new Set(userIds));
  const out: UserGameStat[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    let keys: Record<string, unknown>[] | undefined = unique.slice(i, i + 100).map((userId) => ({ userId, gameId }));
    // Retry unprocessed keys a few times (DynamoDB may throttle part of a batch).
    for (let attempt = 0; keys && keys.length && attempt < 3; attempt++) {
      const res = await ddb.send(new BatchGetCommand({ RequestItems: { [table]: { Keys: keys } } }));
      out.push(...((res.Responses?.[table] || []) as UserGameStat[]));
      keys = res.UnprocessedKeys?.[table]?.Keys as Record<string, unknown>[] | undefined;
    }
  }
  return out;
}
