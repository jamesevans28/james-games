/**
 * Follows and presence (Postgres). Following is instant today: the edge is
 * inserted as "accepted" (friend requests come in T7.6). Names, avatars and
 * levels are joined from users at read time, never copied onto the edge.
 * Presence older than 2 minutes counts as offline (decided by the database clock).
 */
import { getUserById } from "../repos/usersRepo.js";
import {
  acceptedFollowExists,
  countFollowerRows,
  countFollowingRows,
  deleteFollow,
  insertFollow,
  listFollowerRows,
  listFollowingIdRows,
  listFollowingRows,
  type FollowListRow,
} from "../repos/followsRepo.js";
import { gameExists, upsertPresence } from "../repos/presenceRepo.js";
import { buildSummary, type ExperienceSummary } from "./experienceService.js";

export const PRESENCE_STATUSES = [
  "looking_for_game",
  "home",
  "browsing_high_scores",
  "browsing_leaderboard",
  "game_lobby",
  "playing",
  "in_score_dialog",
] as const;

export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export function isPresenceStatus(value: unknown): value is PresenceStatus {
  return typeof value === "string" && (PRESENCE_STATUSES as readonly string[]).includes(value);
}

/** A rule broken by the request: the controller replies `status` with `{ error: code }`. */
export class FollowersError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "FollowersError";
  }
}

export type PresenceRecord = {
  userId: string;
  status: PresenceStatus;
  gameId: string | null;
  /** From the games table, never from the client. */
  gameTitle: string | null;
  updatedAt: string;
};

/** An edge from the owner to someone they follow (GET /followers/following and /activity). */
export type FollowingEdge = {
  userId: string;
  targetUserId: string;
  targetScreenName: string;
  targetAvatar: number;
  createdAt: string;
  /** Null when the person is offline (no presence in the last 2 minutes). */
  presence: PresenceRecord | null;
  /** When their presence was last updated, online or not. */
  lastOnline: string | null;
  targetExperience: ExperienceSummary;
};

/** An edge from a follower to the owner (GET /followers/followers). */
export type FollowerEdge = {
  userId: string;
  targetUserId: string;
  followerScreenName: string;
  followerAvatar: number;
  createdAt: string;
  presence: PresenceRecord | null;
  followerExperience: ExperienceSummary;
};

function experienceOf(row: FollowListRow): ExperienceSummary {
  // Only the XP columns: buildSummary must not see updatedAt or any private field.
  return buildSummary({ xpLevel: row.xpLevel, xpProgress: row.xpProgress, xpTotal: row.xpTotal });
}

function presenceOf(row: FollowListRow): PresenceRecord | null {
  if (!row.online || !row.presenceUpdatedAt || !isPresenceStatus(row.presenceStatus)) return null;
  return {
    userId: row.userId,
    status: row.presenceStatus,
    gameId: row.presenceGameId,
    gameTitle: row.presenceGameTitle,
    updatedAt: row.presenceUpdatedAt.toISOString(),
  };
}

function toFollowingEdge(ownerId: string, row: FollowListRow): FollowingEdge {
  return {
    userId: ownerId,
    targetUserId: row.userId,
    targetScreenName: row.screenName,
    targetAvatar: row.avatar,
    createdAt: row.followedAt.toISOString(),
    presence: presenceOf(row),
    lastOnline: row.presenceUpdatedAt?.toISOString() ?? null,
    targetExperience: experienceOf(row),
  };
}

function toFollowerEdge(ownerId: string, row: FollowListRow): FollowerEdge {
  return {
    userId: row.userId,
    targetUserId: ownerId,
    followerScreenName: row.screenName,
    followerAvatar: row.avatar,
    createdAt: row.followedAt.toISOString(),
    presence: presenceOf(row),
    followerExperience: experienceOf(row),
  };
}

export async function followUser(userId: string, targetUserId: string): Promise<{ ok: true }> {
  if (userId === targetUserId) throw new FollowersError("cannot_follow_self", 400);
  const [follower, target] = await Promise.all([getUserById(userId), getUserById(targetUserId)]);
  if (!follower) throw new FollowersError("profile_not_found", 404);
  if (follower.disabledAt) throw new FollowersError("account_disabled", 403);
  if (!target) throw new FollowersError("user_not_found", 404);
  const created = await insertFollow(userId, targetUserId);
  if (!created) throw new FollowersError("already_following", 409);
  return { ok: true };
}

export async function unfollowUser(userId: string, targetUserId: string): Promise<{ ok: true }> {
  await deleteFollow(userId, targetUserId);
  return { ok: true };
}

/** Everyone `userId` follows, with presence and experience. */
export async function listFollowing(userId: string): Promise<FollowingEdge[]> {
  const rows = await listFollowingRows(userId);
  return rows.map((row) => toFollowingEdge(userId, row));
}

/** Everyone following `userId`, newest first, with presence and experience. */
export async function listFollowers(
  userId: string,
  opts: { limit?: number } = {},
): Promise<FollowerEdge[]> {
  const rows = await listFollowerRows(userId, opts);
  return rows.map((row) => toFollowerEdge(userId, row));
}

/** Followed people who are online now, optionally in one game and/or with given statuses. */
export async function listFollowingActivity(
  userId: string,
  filter: { gameId?: string; statuses?: string[] } = {},
): Promise<FollowingEdge[]> {
  const statuses = filter.statuses?.filter(isPresenceStatus);
  // A status filter with no valid statuses matches nobody.
  if (filter.statuses?.length && !statuses?.length) return [];
  const rows = await listFollowingRows(userId, {
    onlineOnly: true,
    gameId: filter.gameId,
    statuses,
  });
  return rows.map((row) => toFollowingEdge(userId, row));
}

export function isFollowing(userId: string, targetUserId: string): Promise<boolean> {
  return acceptedFollowExists(userId, targetUserId);
}

export function getFollowingIds(userId: string): Promise<string[]> {
  return listFollowingIdRows(userId);
}

export function countFollowing(userId: string): Promise<number> {
  return countFollowingRows(userId);
}

export function countFollowers(userId: string): Promise<number> {
  return countFollowerRows(userId);
}

/** GET /followers/summary: the shape the followers page reads. */
export async function getFollowersSummary(userId: string) {
  const [following, followers] = await Promise.all([listFollowing(userId), listFollowers(userId)]);
  return {
    following: following.map((edge) => ({
      userId: edge.targetUserId,
      targetUserId: edge.targetUserId,
      screenName: edge.targetScreenName,
      targetScreenName: edge.targetScreenName,
      avatar: edge.targetAvatar,
      targetAvatar: edge.targetAvatar,
      createdAt: edge.createdAt,
      level: edge.targetExperience.level,
      presence: edge.presence,
      lastOnline: edge.lastOnline,
    })),
    followers: followers.map((edge) => ({
      userId: edge.userId,
      screenName: edge.followerScreenName,
      avatar: edge.followerAvatar,
      createdAt: edge.createdAt,
      level: edge.followerExperience.level,
    })),
    followingCount: following.length,
    followersCount: followers.length,
  };
}

const NOTIFICATIONS_LIMIT = 100;

/** GET /followers/notifications: the newest followers. */
export async function getFollowNotifications(userId: string) {
  const followers = await listFollowers(userId, { limit: NOTIFICATIONS_LIMIT });
  return followers.map((edge) => ({
    userId: edge.userId,
    screenName: edge.followerScreenName,
    avatar: edge.followerAvatar,
    createdAt: edge.createdAt,
  }));
}

const GAME_ID_MAX_LENGTH = 64;

/**
 * Records what the player is doing. Only a known status and an existing game id
 * are accepted; the title shown to friends always comes from the games table.
 */
export async function updatePresence(
  userId: string,
  input: { status?: unknown; gameId?: unknown },
): Promise<{ ok: true }> {
  if (input.status === undefined || input.status === null || input.status === "") {
    throw new FollowersError("status_required", 400);
  }
  if (!isPresenceStatus(input.status)) throw new FollowersError("invalid_status", 400);
  let gameId: string | null = null;
  if (input.gameId !== undefined && input.gameId !== null && input.gameId !== "") {
    if (
      typeof input.gameId !== "string" ||
      input.gameId.length > GAME_ID_MAX_LENGTH ||
      !(await gameExists(input.gameId))
    ) {
      throw new FollowersError("invalid_game", 400);
    }
    gameId = input.gameId;
  }
  const saved = await upsertPresence(userId, input.status, gameId);
  if (!saved) throw new FollowersError("profile_not_found", 404);
  return { ok: true };
}
