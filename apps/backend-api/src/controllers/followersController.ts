/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- TODO T6.3: untyped DynamoDB items; the Drizzle repository layer gives these real row types */
import type { Request, Response } from "express";
import {
  followUser,
  unfollowUser,
  listFollowingWithPresence,
  listFollowersWithPresence,
  updatePresence,
  countFollowers,
  countFollowing,
  getFollowingIds,
  listFollowers,
} from "../services/followersService.js";
import { sendServerError } from "../lib/http.js";
import { errorInfo } from "../lib/errors.js";

export async function getFollowersSummary(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const [followingRaw, followersRaw, followingCount, followersCount] = await Promise.all([
      listFollowingWithPresence(userId),
      listFollowersWithPresence(userId),
      countFollowing(userId),
      countFollowers(userId),
    ]);
    const following = followingRaw.map((edge) => ({
      userId: edge.targetUserId,
      targetUserId: edge.targetUserId,
      screenName: edge.targetScreenName,
      targetScreenName: edge.targetScreenName,
      avatar: edge.targetAvatar,
      targetAvatar: edge.targetAvatar,
      createdAt: edge.createdAt,
      level: edge.targetExperience?.level ?? null,
      presence: edge.presence,
      lastOnline: edge.presence?.updatedAt ?? null,
    }));
    const followers = followersRaw.map((edge) => ({
      userId: edge.userId,
      screenName: edge.followerScreenName,
      avatar: edge.followerAvatar,
      createdAt: edge.createdAt,
      level: edge.followerExperience?.level ?? null,
    }));
    res.json({ following, followers, followingCount, followersCount });
  } catch (err) {
    sendServerError(res, "followers_request_failed", err);
  }
}

export async function getFollowingList(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const rows = await listFollowingWithPresence(userId);
    res.json({ following: rows });
  } catch (err) {
    sendServerError(res, "followers_request_failed", err);
  }
}

export async function getFollowersList(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const rows = await listFollowersWithPresence(userId);
    res.json({ followers: rows });
  } catch (err) {
    sendServerError(res, "followers_request_failed", err);
  }
}

export async function followUserHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const targetUserId = String((req.params as any).targetUserId);
  try {
    await followUser(userId, targetUserId);
    res.json({ ok: true });
  } catch (err) {
    const { code, message } = errorInfo(err);
    if (code === "CONFLICT" || message === "already_following") {
      return res.status(409).json({ error: "already_following" });
    }
    if (message === "user_not_found") {
      return res.status(404).json({ error: "user_not_found" });
    }
    if (message === "cannot_follow_self") {
      return res.status(400).json({ error: "cannot_follow_self" });
    }
    sendServerError(res, "followers_request_failed", err);
  }
}

export async function unfollowUserHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const targetUserId = String((req.params as any).targetUserId);
  try {
    await unfollowUser(userId, targetUserId);
    res.json({ ok: true });
  } catch (err) {
    sendServerError(res, "followers_request_failed", err);
  }
}

export async function updatePresenceHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const { status, gameId, gameTitle } = (req.body || {}) as {
    status?: string;
    gameId?: string;
    gameTitle?: string;
  };
  if (!status) return res.status(400).json({ error: "status_required" });
  try {
    await updatePresence(userId, {
      status: status as any,
      gameId,
      gameTitle,
    });
    res.json({ ok: true });
  } catch (err) {
    sendServerError(res, "followers_request_failed", err);
  }
}

export async function getFollowingActivity(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const gameId = (req.query as any)?.gameId ? String((req.query as any).gameId) : undefined;
  const statusFilter = ((req.query as any)?.status || "")
    .toString()
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  try {
    const rows = await listFollowingWithPresence(userId, { gameId });
    const filtered = statusFilter.length
      ? rows.filter((row) => row.presence && statusFilter.includes(row.presence.status))
      : rows;
    res.json({ activity: filtered });
  } catch (err) {
    sendServerError(res, "followers_request_failed", err);
  }
}

export async function getFollowingIdsHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const ids = await getFollowingIds(userId);
    res.json({ userIds: ids });
  } catch (err) {
    sendServerError(res, "followers_request_failed", err);
  }
}

export async function getFollowNotifications(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const followers = await listFollowers(userId);
    const notifications = followers
      .map((edge) => ({
        userId: edge.userId,
        screenName: edge.followerScreenName,
        avatar: edge.followerAvatar,
        createdAt: edge.createdAt,
      }))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 100);
    res.json({ notifications });
  } catch (err) {
    sendServerError(res, "followers_request_failed", err);
  }
}
