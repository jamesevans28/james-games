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

export async function getFollowersSummary(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const [following, followersRaw, followingCount, followersCount] = await Promise.all([
      listFollowingWithPresence(userId),
      listFollowersWithPresence(userId),
      countFollowing(userId),
      countFollowers(userId),
    ]);
    const followers = followersRaw.map((edge) => ({
      userId: edge.userId,
      screenName: edge.followerScreenName,
      avatar: edge.followerAvatar,
      createdAt: edge.createdAt,
    }));
    res.json({ following, followers, followingCount, followersCount });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed" });
  }
}

export async function getFollowingList(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const rows = await listFollowingWithPresence(userId);
    res.json({ following: rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed" });
  }
}

export async function getFollowersList(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const rows = await listFollowersWithPresence(userId);
    res.json({ followers: rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed" });
  }
}

export async function followUserHandler(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const targetUserId = String((req.params as any).targetUserId);
  try {
    await followUser(userId, targetUserId);
    res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "CONFLICT" || err?.message === "already_following") {
      return res.status(409).json({ error: "already_following" });
    }
    if (err?.message === "user_not_found") {
      return res.status(404).json({ error: "user_not_found" });
    }
    if (err?.message === "cannot_follow_self") {
      return res.status(400).json({ error: "cannot_follow_self" });
    }
    res.status(500).json({ error: err?.message || "failed" });
  }
}

export async function unfollowUserHandler(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const targetUserId = String((req.params as any).targetUserId);
  try {
    await unfollowUser(userId, targetUserId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed" });
  }
}

export async function updatePresenceHandler(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
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
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed" });
  }
}

export async function getFollowingActivity(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
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
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed" });
  }
}

export async function getFollowingIdsHandler(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const ids = await getFollowingIds(userId);
    res.json({ userIds: ids });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed" });
  }
}

export async function getFollowNotifications(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
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
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed" });
  }
}
