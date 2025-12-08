import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";

const ddb = DynamoDBDocumentClient.from(dynamoClient);

export type WeeklyStat = {
  start: string;
  end: string;
  label: string;
  count: number;
};

export type GameStats = {
  gameId: string;
  totalPlays: number;
  averageScore: number;
  uniquePlayers: number;
  weeklyBreakdown: WeeklyStat[];
  since: string;
};

export async function getGameStats(gameId: string): Promise<GameStats> {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const since = new Date(now - weekMs * 4);
  const sinceIso = since.toISOString();

  const weeklyBuckets = buildWeeklyBuckets(now, weekMs);
  const uniquePlayers = new Set<string>();

  let totalScore = 0;
  let totalPlays = 0;
  let lastKey: Record<string, any> | undefined;
  let iterations = 0;

  do {
    const resp = await ddb.send(
      new QueryCommand({
        TableName: config.tables.scores,
        KeyConditionExpression: "gameId = :g",
        FilterExpression: "createdAt >= :since",
        ExpressionAttributeValues: {
          ":g": gameId,
          ":since": sinceIso,
        },
        ProjectionExpression: "score, createdAt, userId",
        ExclusiveStartKey: lastKey,
      })
    );

    const items = (resp.Items || []) as Array<{
      score?: number;
      createdAt?: string;
      userId?: string;
    }>;
    for (const item of items) {
      if (!item.createdAt) continue;
      const created = Date.parse(item.createdAt);
      if (Number.isNaN(created)) continue;
      totalPlays += 1;
      totalScore += Number(item.score) || 0;
      if (item.userId) uniquePlayers.add(item.userId);
      const bucket = weeklyBuckets.find(
        ({ startMs, endMs }) => created >= startMs && created < endMs
      );
      if (bucket) bucket.count += 1;
    }

    lastKey = resp.LastEvaluatedKey as Record<string, any> | undefined;
    iterations += 1;
  } while (lastKey && iterations < 200);

  return {
    gameId,
    totalPlays,
    averageScore: totalPlays ? totalScore / totalPlays : 0,
    uniquePlayers: uniquePlayers.size,
    weeklyBreakdown: weeklyBuckets.map(({ start, end, label, count }) => ({
      start,
      end,
      label,
      count,
    })),
    since: sinceIso,
  };
}

function buildWeeklyBuckets(nowMs: number, weekMs: number) {
  const buckets: Array<{
    start: string;
    end: string;
    label: string;
    count: number;
    startMs: number;
    endMs: number;
  }> = [];
  for (let i = 4; i >= 1; i -= 1) {
    const startMs = nowMs - weekMs * i;
    const endMs = nowMs - weekMs * (i - 1);
    const start = new Date(startMs);
    const end = new Date(endMs);
    buckets.push({
      start: start.toISOString(),
      end: end.toISOString(),
      label: formatWeekLabel(start),
      count: 0,
      startMs,
      endMs,
    });
  }
  return buckets;
}

function formatWeekLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}
