import type { Request, Response } from "express";
import { getExperienceSummary } from "../services/experienceService.js";
import { sendServerError } from "../lib/http.js";

/**
 * POST /experience/runs is retired: clients used to send their own xpMultiplier here.
 * XP is now awarded by POST /scores from the game's row in the database.
 */
export function recordGameExperience(_req: Request, res: Response) {
  res.status(410).json({ error: "gone", use: "POST /scores (returns awardedXp and summary)" });
}

/** GET /experience/summary → { summary } (null when the player has no profile yet). */
export async function getExperienceSummaryHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const summary = await getExperienceSummary(userId);
    res.json({ summary });
  } catch (err) {
    sendServerError(res, "experience_summary_failed", err);
  }
}
