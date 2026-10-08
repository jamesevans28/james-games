/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- TODO T6.3: untyped DynamoDB items; the Drizzle repository layer gives these real row types */
import type { Request, Response } from "express";
import userService from "../services/userService.js";
import {
  countFollowers,
  countFollowing,
  listFollowers,
  listFollowing,
  isFollowing,
} from "../services/followersService.js";
import { getRecentGamesForUser } from "../services/userGameStatsService.js";
import { toPublicProfile } from "../services/publicProfile.js";
import { sendServerError } from "../lib/http.js";
import { errorInfo } from "../lib/errors.js";

export async function me(req: Request, res: Response) {
  if (!req.user?.userId) return res.json({ user: null });
  try {
    const userId = req.user.userId;
    const profile = await userService.getProfile(userId);
    res.json({
      user: {
        userId,
        email: (profile?.email ?? req.user?.email) || null,
        emailProvided: profile?.emailProvided ?? false,
        screenName: profile.screenName,
        avatar: profile.avatar,
        preferences: profile.preferences,
        validated: profile.validated,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        experience: profile.experience,
        betaTester: profile.betaTester,
        admin: profile.admin,
        // Streak data
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        lastLoginDate: profile.lastLoginDate,
      },
    });
  } catch (e) {
    sendServerError(res, "users_request_failed", e);
  }
}

// Note: Email verification is now handled through Firebase Auth linked providers.
// Users can link their account to Google/Apple which provides verified email.

export async function changeScreenName(req: Request, res: Response) {
  const userId = req.user?.userId as string;
  const { screenName } = (req.body || {}) as { screenName?: string };
  if (!screenName || screenName.trim().length < 2)
    return res.status(400).json({ error: "screenName must be at least 2 chars" });
  try {
    const assigned = await userService.changeScreenName(userId, screenName.trim());
    res.json({ ok: true, screenName: assigned });
  } catch (e) {
    res.status(400).json({ error: errorInfo(e).message || "unable to update screen name" });
  }
}

export async function updatePreferences(req: Request, res: Response) {
  const userId = req.user?.userId as string;
  try {
    await userService.updatePreferencesForUser(userId, req.body || {});
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: errorInfo(e).message || "update failed" });
  }
}

// Unified user settings update endpoint (currently only supports screenName).
// PATCH /users/settings { screenName: string }
export async function updateSettings(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const { screenName } = (req.body || {}) as { screenName?: string };
  if (!screenName || screenName.trim().length < 2) {
    return res.status(400).json({ error: "screenName must be >= 2 chars" });
  }
  try {
    const assigned = await userService.changeScreenName(userId, screenName.trim());
    res.json({ ok: true, screenName: assigned });
  } catch (e) {
    res.status(400).json({ error: errorInfo(e).message || "update failed" });
  }
}

export async function getPublicProfile(req: Request, res: Response) {
  const targetUserId = String((req.params as any)?.userId || "").trim();
  if (!targetUserId) return res.status(400).json({ error: "userId_required" });
  try {
    const profile = await userService.getProfile(targetUserId);
    if (!profile || !profile.screenName) {
      return res.status(404).json({ error: "user_not_found" });
    }
    const [followingCount, followersCount, followingEdges, followerEdges, recentGames] =
      await Promise.all([
        countFollowing(targetUserId),
        countFollowers(targetUserId),
        listFollowing(targetUserId),
        listFollowers(targetUserId),
        getRecentGamesForUser(targetUserId, 10),
      ]);
    const viewerId = req.user?.userId;
    let viewerFollows = false;
    if (viewerId && viewerId !== targetUserId) {
      viewerFollows = await isFollowing(viewerId, targetUserId);
    }
    res.json({
      // Whitelisted fields only: never email, admin, preferences or last login.
      profile: toPublicProfile(profile),
      followingCount,
      followersCount,
      following: followingEdges.slice(0, 25).map((edge) => ({
        userId: edge.targetUserId,
        screenName: edge.targetScreenName,
        avatar: edge.targetAvatar,
        createdAt: edge.createdAt,
      })),
      followers: followerEdges.slice(0, 25).map((edge) => ({
        userId: edge.userId,
        screenName: edge.followerScreenName,
        avatar: edge.followerAvatar,
        createdAt: edge.createdAt,
      })),
      recentGames,
      isSelf: viewerId === targetUserId,
      isFollowing: viewerFollows,
    });
  } catch (err) {
    sendServerError(res, "users_request_failed", err);
  }
}
