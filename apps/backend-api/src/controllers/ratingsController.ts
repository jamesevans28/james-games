import type { Request, Response } from "express";
import {
  getRatingSummary,
  getRatingSummaries,
  getUserRating,
  upsertRating,
  validateRatingInput,
} from "../services/ratingsService.js";

export async function listRatingSummaries(req: Request, res: Response) {
  try {
    const idsRaw = String((req.query as any).ids || "");
    const ids = idsRaw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (!ids.length) return res.json({ summaries: [] });
    const summaries = await getRatingSummaries(ids);
    res.json({ summaries });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Server error" });
  }
}

export async function getRatingSummaryController(req: Request, res: Response) {
  try {
    const gameId = String((req.params as any).gameId);
    const summary = await getRatingSummary(gameId);
    // @ts-ignore
    const userId = req.user?.userId as string | undefined;
    if (userId) {
      const userRating = await getUserRating(gameId, userId);
      if (typeof userRating === "number") {
        return res.json({ ...summary, userRating });
      }
    }
    res.json(summary);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Server error" });
  }
}

export async function submitRating(req: Request, res: Response) {
  try {
    const { rating } = (req.body || {}) as any;
    const { gameId, rating: ratingValue } = validateRatingInput(
      (req.params as any).gameId,
      rating
    );
    // @ts-ignore
    const userId = req.user?.userId as string | undefined;
    if (!userId) return res.status(401).json({ error: "unauthorized" });
    const result = await upsertRating({ gameId, userId, rating: ratingValue });
    res.json(result);
  } catch (e: any) {
    if (e?.message?.includes("required") || e?.message?.includes("between")) {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: e?.message || "Server error" });
  }
}
