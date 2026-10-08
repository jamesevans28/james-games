/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- TODO T6.3: untyped DynamoDB items; the Drizzle repository layer gives these real row types */
import type { Request, Response } from "express";
import {
  getRatingSummary,
  getRatingSummaries,
  getUserRating,
  upsertRating,
  validateRatingInput,
} from "../services/ratingsService.js";
import { sendServerError } from "../lib/http.js";
import { errorInfo } from "../lib/errors.js";

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
  } catch (e) {
    sendServerError(res, "ratings_request_failed", e);
  }
}

export async function getRatingSummaryController(req: Request, res: Response) {
  try {
    const gameId = String((req.params as any).gameId);
    const summary = await getRatingSummary(gameId);
    const userId = req.user?.userId;
    if (userId) {
      const userRating = await getUserRating(gameId, userId);
      if (typeof userRating === "number") {
        return res.json({ ...summary, userRating });
      }
    }
    res.json(summary);
  } catch (e) {
    sendServerError(res, "ratings_request_failed", e);
  }
}

export async function submitRating(req: Request, res: Response) {
  try {
    const { rating } = req.body || {};
    const { gameId, rating: ratingValue } = validateRatingInput((req.params as any).gameId, rating);
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "unauthorized" });
    const result = await upsertRating({ gameId, userId, rating: ratingValue });
    res.json(result);
  } catch (e) {
    const { message } = errorInfo(e);
    if (message && (message.includes("required") || message.includes("between"))) {
      return res.status(400).json({ error: message });
    }
    sendServerError(res, "ratings_request_failed", e);
  }
}
