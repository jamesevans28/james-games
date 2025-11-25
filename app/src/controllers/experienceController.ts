import type { Request, Response } from "express";
import {
  applyExperienceToUser,
  calculateExperienceForDuration,
  getExperienceSummary,
} from "../services/experienceService.js";

export async function recordGameExperience(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.userId as string | undefined;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const { gameId, durationMs } = (req.body || {}) as { gameId?: string; durationMs?: number };
  if (!gameId) return res.status(400).json({ error: "gameId_required" });
  const duration = Number(durationMs);
  if (!Number.isFinite(duration) || duration <= 0) {
    return res.status(400).json({ error: "duration_invalid" });
  }
  try {
    const xp = calculateExperienceForDuration(duration);
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
