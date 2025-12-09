import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";
import { listGameConfigs } from "./gamesConfigService.js";

const ddb = DynamoDBDocumentClient.from(dynamoClient);

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type DashboardMetrics = {
  timeframe: { since: string; days: number };
  totals: {
    users: number;
    betaTesters: number;
    admins: number;
    newUsers7d: number;
    gamesLive: number;
  };
  activity: {
    activeUsers7d: number;
    totalPlays7d: number;
    avgScore7d: number;
  };
  topGames: Array<{
    gameId: string;
    title: string;
    thumbnail?: string | null;
    plays7d: number;
    share: number;
  }>;
  recommendations: string[];
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const sinceMs = Date.now() - WEEK_MS;
  const sinceIso = new Date(sinceMs).toISOString();

  const [userSummary, activitySummary, allGames] = await Promise.all([
    summarizeUsers(sinceIso),
    summarizeActivity(sinceIso),
    fetchAllGames(),
  ]);

  const gamesMap = new Map(allGames.map((game) => [game.gameId, game]));
  const topGames = activitySummary.gameCounts
    .map(({ gameId, count }) => ({
      gameId,
      title: gamesMap.get(gameId)?.title || gameId,
      thumbnail: gamesMap.get(gameId)?.thumbnail ?? null,
      plays7d: count,
    }))
    .sort((a, b) => b.plays7d - a.plays7d)
    .slice(0, 5)
    .map((game) => ({
      ...game,
      share: activitySummary.totalPlays7d
        ? Number((game.plays7d / activitySummary.totalPlays7d).toFixed(3))
        : 0,
    }));

  const recommendations = buildRecommendations(userSummary, activitySummary, topGames);

  return {
    timeframe: { since: sinceIso, days: 7 },
    totals: {
      users: userSummary.total,
      betaTesters: userSummary.betaTesters,
      admins: userSummary.admins,
      newUsers7d: userSummary.newUsers,
      gamesLive: allGames.length,
    },
    activity: {
      activeUsers7d: activitySummary.activeUsers,
      totalPlays7d: activitySummary.totalPlays7d,
      avgScore7d: activitySummary.totalPlays7d
        ? Number((activitySummary.totalScore7d / activitySummary.totalPlays7d).toFixed(2))
        : 0,
    },
    topGames,
    recommendations,
  };
}

async function summarizeUsers(sinceIso: string) {
  if (!config.tables.users) {
    return { total: 0, betaTesters: 0, admins: 0, newUsers: 0 };
  }
  let total = 0;
  let betaTesters = 0;
  let admins = 0;
  let newUsers = 0;
  let lastKey: Record<string, any> | undefined;
  let iterations = 0;

  do {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: config.tables.users,
        ProjectionExpression: "userId, betaTester, admin, createdAt",
        ExclusiveStartKey: lastKey,
      })
    );
    const items = resp.Items || [];
    for (const item of items) {
      total += 1;
      if (item?.betaTester) betaTesters += 1;
      if (item?.admin) admins += 1;
      if (item?.createdAt && item.createdAt >= sinceIso) newUsers += 1;
    }
    lastKey = resp.LastEvaluatedKey as Record<string, any> | undefined;
    iterations += 1;
  } while (lastKey && iterations < 500);

  return { total, betaTesters, admins, newUsers };
}

async function summarizeActivity(sinceIso: string) {
  if (!config.tables.scores) {
    return {
      activeUsers: 0,
      totalPlays7d: 0,
      totalScore7d: 0,
      gameCounts: [] as Array<{ gameId: string; count: number }>,
    };
  }

  const userIds = new Set<string>();
  const gameCounter = new Map<string, number>();
  let totalPlays7d = 0;
  let totalScore7d = 0;
  let lastKey: Record<string, any> | undefined;
  let iterations = 0;

  do {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: config.tables.scores,
        ProjectionExpression: "#g, score, createdAt, userId",
        FilterExpression: "createdAt >= :since",
        ExpressionAttributeNames: { "#g": "gameId" },
        ExpressionAttributeValues: { ":since": sinceIso },
        ExclusiveStartKey: lastKey,
      })
    );

    const items = resp.Items || [];
    for (const raw of items) {
      const createdAt = raw?.createdAt as string | undefined;
      if (!createdAt || createdAt < sinceIso) continue;
      totalPlays7d += 1;
      const numericScore = Number(raw?.score ?? 0);
      if (!Number.isNaN(numericScore)) totalScore7d += numericScore;
      const gid = raw?.gameId as string | undefined;
      if (gid) gameCounter.set(gid, (gameCounter.get(gid) || 0) + 1);
      const uid = raw?.userId as string | undefined;
      if (uid) userIds.add(uid);
    }

    lastKey = resp.LastEvaluatedKey as Record<string, any> | undefined;
    iterations += 1;
  } while (lastKey && iterations < 500);

  return {
    activeUsers: userIds.size,
    totalPlays7d,
    totalScore7d,
    gameCounts: Array.from(gameCounter.entries()).map(([gameId, count]) => ({ gameId, count })),
  };
}

async function fetchAllGames() {
  const games = [] as Array<{ gameId: string; title: string; thumbnail?: string | null }>;
  let cursor: string | undefined;
  let iterations = 0;
  do {
    const resp = await listGameConfigs({ limit: 100, cursor });
    games.push(
      ...resp.items.map((g) => ({ gameId: g.gameId, title: g.title, thumbnail: g.thumbnail ?? null }))
    );
    cursor = resp.nextCursor;
    iterations += 1;
  } while (cursor && iterations < 20);
  return games;
}

function buildRecommendations(
  users: { total: number; betaTesters: number; admins: number; newUsers: number },
  activity: { activeUsers: number; totalPlays7d: number },
  topGames: Array<{ gameId: string; title: string; plays7d: number; share: number }>
) {
  const recs: string[] = [];
  if (topGames[0] && topGames[0].share > 0.4) {
    recs.push(
      `${topGames[0].title} accounts for ${(topGames[0].share * 100).toFixed(1)}% of weekly plays — consider featuring another game to balance engagement.`
    );
  }
  if (activity.activeUsers < Math.max(10, Math.round(users.total * 0.1))) {
    recs.push("Active users are low versus total audience — schedule a push notification or email campaign.");
  }
  if (users.betaTesters / Math.max(users.total, 1) < 0.05) {
    recs.push("Recruit more beta testers to keep early feedback flowing.");
  }
  if (!recs.length) {
    recs.push("Engagement is healthy. Plan the next game drop to maintain momentum.");
  }
  return recs;
}
