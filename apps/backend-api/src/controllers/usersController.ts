import type { Request, Response } from "express";
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
  GetUserAttributeVerificationCodeCommand,
  VerifyUserAttributeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { config } from "../config/index.js";
import userService from "../services/userService.js";
import { cognitoClient } from "../config/aws.js";
import {
  countFollowers,
  countFollowing,
  listFollowers,
  listFollowing,
  isFollowing,
} from "../services/followersService.js";
import { getRecentGamesForUser } from "../services/userGameStatsService.js";

export async function me(req: Request, res: Response) {
  // @ts-ignore
  if (!req.user?.userId) return res.json({ user: null });
  try {
    const userId = (req as any).user.userId as string;
    const profile = await userService.getProfile(userId);
    res.json({
      user: {
        userId,
        // @ts-ignore
        email: (profile?.email ?? (req as any).user?.email) || null,
        emailProvided:
          profile?.emailProvided ??
          // @ts-ignore
          (req as any).user?.emailProvided ??
          false,
        screenName: profile.screenName,
        avatar: profile.avatar,
        preferences: profile.preferences,
        validated: profile.validated,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        experience: profile.experience,
        betaTester: profile.betaTester,
        admin: profile.admin,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "failed" });
  }
}

export async function startEmailUpdate(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string;
  const { email } = (req.body || {}) as { email?: string };
  if (!email) return res.status(400).json({ error: "email required" });
  try {
    const accessToken = (req as any).cookies?.accessToken as string | undefined;
    await userService.startEmailUpdateForUser(userId, email, accessToken);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "failed to start email update" });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string;
  const { code } = (req.body || {}) as { code?: string };
  if (!code) return res.status(400).json({ error: "code required" });
  try {
    const accessToken = (req as any).cookies?.accessToken as string | undefined;
    await userService.verifyEmailForUser(userId, accessToken, code);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "verify failed" });
  }
}

export async function changeScreenName(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string;
  const { screenName } = (req.body || {}) as { screenName?: string };
  if (!screenName || screenName.trim().length < 2)
    return res.status(400).json({ error: "screenName must be at least 2 chars" });
  try {
    const assigned = await userService.changeScreenName(userId, screenName.trim());
    res.json({ ok: true, screenName: assigned });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "unable to update screen name" });
  }
}

export async function updatePreferences(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string;
  try {
    await userService.updatePreferencesForUser(userId, req.body || {});
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "update failed" });
  }
}

// Unified user settings update endpoint (currently only supports screenName).
// PATCH /users/settings { screenName: string }
export async function updateSettings(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const { screenName } = (req.body || {}) as { screenName?: string };
  if (!screenName || screenName.trim().length < 2) {
    return res.status(400).json({ error: "screenName must be >= 2 chars" });
  }
  try {
    const assigned = await userService.changeScreenName(userId, screenName.trim());
    res.json({ ok: true, screenName: assigned });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "update failed" });
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
    // @ts-ignore
    const viewerId = req.user?.userId as string | undefined;
    let viewerFollows = false;
    if (viewerId && viewerId !== targetUserId) {
      viewerFollows = await isFollowing(viewerId, targetUserId);
    }
    res.json({
      profile,
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
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed" });
  }
}
