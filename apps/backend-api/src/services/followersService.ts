// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  GetCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";
import { getUser } from "./dynamoService.js";
import { buildSummary, ExperienceSummary } from "./experienceService.js";

const ddb = DynamoDBDocumentClient.from(dynamoClient);
const FOLLOWED_BY_INDEX = config.tables.followsByTargetIndex || "FollowedBy";
const PRESENCE_TTL_SECONDS = Number(process.env.PRESENCE_TTL_SECONDS || 120);

export type FollowEdge = {
  userId: string;
  targetUserId: string;
  targetScreenName?: string | null;
  targetAvatar?: number | null;
  followerScreenName?: string | null;
  followerAvatar?: number | null;
  createdAt: string;
};

export type PresenceStatus =
  | "looking_for_game"
  | "home"
  | "browsing_high_scores"
  | "browsing_leaderboard"
  | "game_lobby"
  | "playing"
  | "in_score_dialog";

export type PresenceRecord = {
  userId: string;
  status: PresenceStatus;
  gameId?: string;
  gameTitle?: string;
  updatedAt: string;
};

export type PresenceUpdatePayload = {
  status: PresenceStatus;
  gameId?: string;
  gameTitle?: string;
};

export async function followUser(userId: string, targetUserId: string) {
  if (!config.tables.follows) throw new Error("follows_table_not_configured");
  if (userId === targetUserId) throw new Error("cannot_follow_self");
  const targetProfile = await getUser(targetUserId);
  if (!targetProfile) throw new Error("user_not_found");
  const followerProfile = await getUser(userId);
  const now = new Date().toISOString();
  try {
    await ddb.send(
      new PutCommand({
        TableName: config.tables.follows,
        Item: {
          userId,
          targetUserId,
          targetScreenName: targetProfile.screenName ?? null,
          targetAvatar: typeof targetProfile.avatar === "number" ? targetProfile.avatar : null,
          followerScreenName: followerProfile?.screenName ?? null,
          followerAvatar:
            typeof followerProfile?.avatar === "number" ? followerProfile.avatar : null,
          createdAt: now,
        },
        ConditionExpression: "attribute_not_exists(userId) AND attribute_not_exists(targetUserId)",
      })
    );
  } catch (err: any) {
    if (err?.name === "ConditionalCheckFailedException") {
      const e = new Error("already_following");
      // @ts-ignore code for controller mapping
      e.code = "CONFLICT";
      throw e;
    }
    throw err;
  }
  return { ok: true };
}

export async function unfollowUser(userId: string, targetUserId: string) {
  if (!config.tables.follows) throw new Error("follows_table_not_configured");
  await ddb.send(
    new DeleteCommand({
      TableName: config.tables.follows,
      Key: { userId, targetUserId },
    })
  );
  return { ok: true };
}

export async function listFollowing(userId: string): Promise<FollowEdge[]> {
  if (!config.tables.follows) return [];
  const res = await ddb.send(
    new QueryCommand({
      TableName: config.tables.follows,
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": userId },
    })
  );
  return (res.Items || []) as FollowEdge[];
}

export async function listFollowers(userId: string): Promise<FollowEdge[]> {
  if (!config.tables.follows || !FOLLOWED_BY_INDEX) return [];
  const res = await ddb.send(
    new QueryCommand({
      TableName: config.tables.follows,
      IndexName: FOLLOWED_BY_INDEX,
      KeyConditionExpression: "targetUserId = :t",
      ExpressionAttributeValues: { ":t": userId },
    })
  );
  return (res.Items || []) as FollowEdge[];
}

export async function isFollowing(userId: string, targetUserId: string): Promise<boolean> {
  if (!config.tables.follows) return false;
  const res = await ddb.send(
    new GetCommand({
      TableName: config.tables.follows,
      Key: { userId, targetUserId },
    })
  );
  return !!res.Item;
}

export async function countFollowing(userId: string) {
  if (!config.tables.follows) return 0;
  const res = await ddb.send(
    new QueryCommand({
      TableName: config.tables.follows,
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": userId },
      Select: "COUNT",
    })
  );
  return res.Count || 0;
}

export async function countFollowers(userId: string) {
  if (!config.tables.follows || !FOLLOWED_BY_INDEX) return 0;
  const res = await ddb.send(
    new QueryCommand({
      TableName: config.tables.follows,
      IndexName: FOLLOWED_BY_INDEX,
      KeyConditionExpression: "targetUserId = :t",
      ExpressionAttributeValues: { ":t": userId },
      Select: "COUNT",
    })
  );
  return res.Count || 0;
}

export async function updatePresence(userId: string, payload: PresenceUpdatePayload) {
  if (!config.tables.presence) throw new Error("presence_table_not_configured");
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const expiresAt = Math.floor(now / 1000) + PRESENCE_TTL_SECONDS;
  await ddb.send(
    new PutCommand({
      TableName: config.tables.presence,
      Item: {
        userId,
        status: payload.status,
        gameId: payload.gameId || null,
        gameTitle: payload.gameTitle || null,
        updatedAt: iso,
        expiresAt,
      },
    })
  );
  return { ok: true };
}

export async function getPresence(userId: string): Promise<PresenceRecord | null> {
  if (!config.tables.presence) return null;
  const res = await ddb.send(
    new GetCommand({
      TableName: config.tables.presence,
      Key: { userId },
    })
  );
  return (res.Item as PresenceRecord) || null;
}

export async function getPresenceForUsers(
  userIds: string[]
): Promise<Record<string, PresenceRecord>> {
  if (!config.tables.presence || userIds.length === 0) return {};
  const unique = Array.from(new Set(userIds));
  const batches: string[][] = [];
  while (unique.length) batches.push(unique.splice(0, 100));
  const out: Record<string, PresenceRecord> = {};
  for (const batch of batches) {
    const res = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [config.tables.presence]: {
            Keys: batch.map((userId) => ({ userId })),
          },
        },
      })
    );
    const rows = res.Responses?.[config.tables.presence] || [];
    rows.forEach((item) => {
      const record = item as PresenceRecord;
      if (record?.userId) out[record.userId] = record;
    });
  }
  return out;
}

export type FollowingEdgeWithExtras = FollowEdge & {
  presence?: PresenceRecord | null;
  targetExperience?: ExperienceSummary | null;
};

export type FollowerEdgeWithExtras = FollowEdge & {
  presence?: PresenceRecord | null;
  followerExperience?: ExperienceSummary | null;
};

async function buildProfileMap(userIds: string[]) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const pairs = await Promise.all(
    unique.map(async (id) => {
      try {
        const profile = await getUser(id);
        return profile ? ([id, profile] as const) : null;
      } catch (err) {
        console.warn("followersService: failed to fetch profile", id, err);
        return null;
      }
    })
  );
  return pairs.reduce<Record<string, any>>((acc, pair) => {
    if (!pair) return acc;
    acc[pair[0]] = pair[1];
    return acc;
  }, {});
}

export async function listFollowingWithPresence(
  userId: string,
  opts: { gameId?: string } = {}
): Promise<FollowingEdgeWithExtras[]> {
  const edges = await listFollowing(userId);
  if (!edges.length) return [];
  const presenceMap = await getPresenceForUsers(edges.map((edge) => edge.targetUserId));
  const profileMap = await buildProfileMap(edges.map((edge) => edge.targetUserId));
  return edges
    .map((edge) => {
      const presence = presenceMap[edge.targetUserId];
      const profile = profileMap[edge.targetUserId];
      return {
        ...edge,
        presence,
        targetExperience: profile ? buildSummary(profile) : null,
      };
    })
    .filter((edge) => {
      if (!opts.gameId) return true;
      return edge.presence?.gameId === opts.gameId;
    });
}

export async function listFollowersWithPresence(
  targetUserId: string
): Promise<FollowerEdgeWithExtras[]> {
  const edges = await listFollowers(targetUserId);
  if (!edges.length) return [];
  const presenceMap = await getPresenceForUsers(edges.map((edge) => edge.userId));
  const profileMap = await buildProfileMap(edges.map((edge) => edge.userId));
  return edges.map((edge) => ({
    ...edge,
    presence: presenceMap[edge.userId],
    followerExperience: profileMap[edge.userId] ? buildSummary(profileMap[edge.userId]) : null,
  }));
}

export async function getFollowingIds(userId: string): Promise<string[]> {
  const rows = await listFollowing(userId);
  return rows.map((row) => row.targetUserId);
}
