import type { Request, Response } from "express";
import {
  applyExperienceToUser,
  calculateExperienceForScore,
  getExperienceSummary,
} from "../services/experienceService.js";

export async function recordGameExperience(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const { gameId, score, xpMultiplier } = (req.body || {}) as { gameId?: string; score?: number; xpMultiplier?: number };
  if (!gameId) return res.status(400).json({ error: "gameId_required" });
  const scoreNum = Number(score);
  if (!Number.isFinite(scoreNum) || scoreNum <= 0) {
    return res.status(400).json({ error: "score_invalid" });
  }
  const multiplier = Number(xpMultiplier) || 1.0;
  try {
    const xp = calculateExperienceForScore(scoreNum, multiplier);
    const result = await applyExperienceToUser(userId, xp);
    res.json({ ok: true, awardedXp: result.awarded, summary: result.summary });
  } catch (err: any) {
    if (err?.message === "user_not_found") {
      return res.status(404).json({ error: "user_not_found" });
    }
    res.status(500).json({ error: err?.message || "failed" });
  }
}

export async function getExperienceSummaryHandler(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const summary = await getExperienceSummary(userId);
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed" });
  }
}
