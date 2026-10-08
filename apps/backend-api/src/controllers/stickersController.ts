import type { Request, Response } from "express";
import streakService from "../services/streakService.js";
import { sendServerError } from "../lib/http.js";

/**
 * GET /users/stickers — the caller's collected stickers, newest first:
 * { stickers: [{ id: "week-2026-41", earnedAt: ISO string }] }.
 */
export async function getMyStickers(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    res.json({ stickers: await streakService.listUserStickers(userId) });
  } catch (e) {
    sendServerError(res, "stickers_get_failed", e);
  }
}
