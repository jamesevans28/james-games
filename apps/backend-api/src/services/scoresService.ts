import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";
import { getUser } from "./dynamoService.js";
import { recordUserGameSession } from "./userGameStatsService.js";
import { randomUUID } from "crypto";

const ddb = DynamoDBDocumentClient.from(dynamoClient);

// New score item shape (v2):
// gameId (PK)
// score (numeric) used as GSI sort key via GameScoresByScore
// createdAt ISO string
// userId (optional for legacy guest scores)
// screenNameSnapshot (string) preserved at time of write – used only as fallback
// avatarSnapshot (number) preserved at time of write – used only as fallback
// legacyName (string) for old rows migrated from previous table
// version: 2 (optional for future migrations)

export interface RawScoreItem {
  // id is the sort key (new table schema) so every play is a unique item
  id: string;
  gameId: string;
  score: number;
  createdAt: string;
  userId?: string;
  screenNameSnapshot?: string;
  avatarSnapshot?: number;
  legacyName?: string;
  version?: number;
}

export interface PublicScoreRow {
  userId?: string;
  screenName: string;
  avatar: number;
  score: number;
  createdAt: string;
  level?: number | null;
}

/**
 * Write a score with user context. If user info is provided we snapshot
 * screenName & avatar but later readers will prefer the CURRENT user profile.
 */
export async function putScoreWithUser(args: {
  gameId: string;
  score: number;
  userId?: string;
  screenName?: string | null;
  avatar?: number | null;
}) {
  const now = new Date().toISOString();
  const item: RawScoreItem = {
    id: randomUUID(),
    gameId: args.gameId,
    score: args.score,
    createdAt: now,
    version: 2,
  };
  if (args.userId) {
    item.userId = args.userId;
    if (args.screenName) item.screenNameSnapshot = args.screenName;
    if (typeof args.avatar === "number") item.avatarSnapshot = args.avatar;
  }
  await ddb.send(
    new PutCommand({
      TableName: config.tables.scores,
      Item: item,
    })
  );
  if (args.userId) {
    recordUserGameSession(args.userId, args.gameId, args.score).catch((err) => {
      console.warn("recordUserGameSession failed", err);
    });
  }
  return item;
}

/**
 * Fetch top scores and hydrate with CURRENT user profile (screenName/avatar).
 * Fallback: snapshot values or legacyName when user no longer exists.
 */
export async function getTopScoresHydrated(
  gameId: string,
  limit = 10,
  opts?: { includeUserIds?: string[] }
): Promise<PublicScoreRow[]> {
  const fetchLimit = Math.max(limit * 5, 100);
  const result = await ddb.send(
    new QueryCommand({
      TableName: config.tables.scores,
      IndexName: config.tables.scoreGsi,
      KeyConditionExpression: "gameId = :g",
      ExpressionAttributeValues: { ":g": gameId },
      ScanIndexForward: false, // descending by score (if GSI sort key is score)
      Limit: fetchLimit,
    })
  );
  const items = (result.Items || []) as RawScoreItem[];
  // Re-sort to guarantee ordering (score desc, createdAt asc for tie-break)
  items.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.createdAt.localeCompare(b.createdAt);
  });
  let filtered = items;
  if (opts?.includeUserIds && opts.includeUserIds.length > 0) {
    const allowed = new Set(opts.includeUserIds);
    filtered = items.filter((row) => row.userId && allowed.has(row.userId));
  }
  const sliced = filtered.slice(0, limit);
  // Collect distinct userIds for profile hydration
  const userIds = Array.from(new Set(sliced.map((r) => r.userId).filter(Boolean))) as string[];
  const userProfiles: Record<string, any> = {};
  // Fetch each user profile (sequential; could batch/parallel for optimization)
  for (const uid of userIds) {
    try {
      const profile = await getUser(uid);
      if (profile) userProfiles[uid] = profile;
    } catch {
      // ignore individual failures
    }
  }
  return sliced.map((row) => {
    const profile = row.userId ? userProfiles[row.userId] : null;
    const screenName =
      (profile?.screenName as string) || row.screenNameSnapshot || row.legacyName || "Player";
    const avatar =
      typeof profile?.avatar === "number"
        ? profile.avatar
        : typeof row.avatarSnapshot === "number"
        ? row.avatarSnapshot
        : 1;
    return {
      userId: row.userId,
      screenName,
      avatar,
      score: row.score,
      createdAt: row.createdAt,
      level: typeof profile?.xpLevel === "number" ? profile.xpLevel : undefined,
    };
  });
}

/**
 * Helper to adapt legacy score rows (if scanning old table). Provided here
 * for future migration scripts.
 */
export function adaptLegacyRow(legacy: any): RawScoreItem {
  return {
    id: randomUUID(),
    gameId: legacy.gameId,
    score: Number(legacy.score || 0),
    createdAt: legacy.createdAt || new Date().toISOString(),
    legacyName: legacy.name ? String(legacy.name) : undefined,
    version: 1,
  };
}

/**
 * Simple validation helper for incoming score submissions.
 */
export function validateScoreInput(
  gameId: unknown,
  score: unknown
): { gameId: string; score: number } {
  if (!gameId || typeof gameId !== "string") throw new Error("gameId required");
  const num = Number(score);
  if (!Number.isFinite(num)) throw new Error("score must be a number");
  return { gameId, score: num };
}
