import type { Request, Response } from "express";
import {
  clampFeedLimit,
  getPersonalizedFeed as personalizedFeed,
  getPublicFeed,
} from "../services/feedService.js";

/** GET /games/feed?limit= */
export async function getFeed(req: Request, res: Response) {
  res.json(await getPublicFeed(clampFeedLimit(req.query.limit)));
}

/** GET /games/feed/personalized?limit= (requireAuth). */
export async function getPersonalizedFeed(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  res.json(await personalizedFeed(userId, clampFeedLimit(req.query.limit)));
}
