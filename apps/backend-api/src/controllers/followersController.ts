import type { Request, Response } from "express";
import {
  FollowersError,
  followUser,
  getFollowersSummary as buildFollowersSummary,
  getFollowNotifications as listFollowNotifications,
  getFollowingIds,
  listFollowers,
  listFollowing,
  listFollowingActivity,
  unfollowUser,
  updatePresence,
} from "../services/followersService.js";
import { sendServerError } from "../lib/http.js";

/** Wraps a handler: requires a signed-in user, sends the result as JSON, maps rule errors. */
function handler(fn: (req: Request, userId: string) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "unauthorized" });
    try {
      res.json(await fn(req, userId));
    } catch (err) {
      if (err instanceof FollowersError) return res.status(err.status).json({ error: err.code });
      sendServerError(res, "followers_request_failed", err);
    }
  };
}

function queryString(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const getFollowersSummary = handler((_req, userId) => buildFollowersSummary(userId));

export const getFollowingList = handler(async (_req, userId) => ({
  following: await listFollowing(userId),
}));

export const getFollowersList = handler(async (_req, userId) => ({
  followers: await listFollowers(userId),
}));

export const followUserHandler = handler((req, userId) =>
  followUser(userId, String(req.params.targetUserId)),
);

export const unfollowUserHandler = handler((req, userId) =>
  unfollowUser(userId, String(req.params.targetUserId)),
);

export const updatePresenceHandler = handler((req, userId) => {
  const body = (req.body ?? {}) as { status?: unknown; gameId?: unknown };
  return updatePresence(userId, { status: body.status, gameId: body.gameId });
});

export const getFollowingActivity = handler(async (req, userId) => {
  const statuses = (queryString(req, "status") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const activity = await listFollowingActivity(userId, {
    gameId: queryString(req, "gameId"),
    statuses,
  });
  return { activity };
});

export const getFollowingIdsHandler = handler(async (_req, userId) => ({
  userIds: await getFollowingIds(userId),
}));

export const getFollowNotifications = handler(async (_req, userId) => ({
  notifications: await listFollowNotifications(userId),
}));
