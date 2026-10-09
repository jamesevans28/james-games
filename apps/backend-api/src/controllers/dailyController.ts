import type { Request, Response } from "express";
import { getDailyChallenge } from "../services/dailyService.js";
import { sendServerError } from "../lib/http.js";

/**
 * GET /daily?tz=<minutes east of UTC> (T11.3): today's challenge for the
 * player's local day: { day, gameId, seed, myRun?, board }. Public; signed-in
 * players also get their own run, and never see anyone in a block with them.
 */
export async function getDaily(req: Request, res: Response) {
  try {
    const tz = Number(req.query.tz);
    res.json(await getDailyChallenge(req.user?.userId, Number.isFinite(tz) ? tz : 0));
  } catch (e) {
    sendServerError(res, "daily_get_failed", e);
  }
}
