import type { Request, Response } from "express";
import { getRatingSummaries, getRatingSummary, rateGame } from "../services/ratingsService.js";

/** GET /ratings?ids=a,b,c → { summaries } (zeros for unrated games). */
export async function listRatingSummaries(req: Request, res: Response) {
  const raw = typeof req.query.ids === "string" ? req.query.ids : "";
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  res.json({ summaries: ids.length ? await getRatingSummaries(ids) : [] });
}

/** GET /ratings/:gameId → summary, with userRating when the viewer has rated. */
export async function getRatingSummaryController(req: Request, res: Response) {
  res.json(await getRatingSummary(String(req.params.gameId), req.user?.userId));
}

/** POST /ratings/:gameId { rating: 1–5 } (requireAuth) → summary with userRating. */
export async function submitRating(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const body = (req.body ?? {}) as { rating?: unknown };
  const result = await rateGame(userId, String(req.params.gameId), body.rating);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json(result.summary);
}
