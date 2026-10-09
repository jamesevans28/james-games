import type { Request, Response } from "express";
import {
  RemixError,
  createRemix as createRemixFor,
  getRemix as getRemixFor,
  getRemixLeaderboard,
  listMyRemixes,
} from "../services/remixService.js";
import { leaderboardLimit } from "../services/leaderboardRules.js";
import { sendServerError } from "../lib/http.js";
import { log } from "../lib/log.js";
import { bodyOf } from "./usersController.js";

/** Answers a RemixError with its status, code and friendly message; anything else is a 500. */
function replyWithError(res: Response, event: string, err: unknown) {
  if (err instanceof RemixError) {
    if (err.status >= 400 && err.status !== 404) log.warn(event, { code: err.code });
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  return sendServerError(res, event, err);
}

/** POST /remixes { gameId, name, knobs } (registered accounts only) → 201 { remix }. */
export async function createRemix(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const remix = await createRemixFor(userId, bodyOf(req));
    res.status(201).json({ remix });
  } catch (e) {
    replyWithError(res, "remix_create_refused", e);
  }
}

/** GET /remixes/mine?gameId= → { remixes } (the signed-in player's own). */
export async function listMine(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    res.json({ remixes: await listMyRemixes(userId, req.query.gameId) });
  } catch (e) {
    replyWithError(res, "remix_list_failed", e);
  }
}

/** GET /remixes/:id → { remix } (public: name, game, knobs, maker's screen name). */
export async function getRemix(req: Request, res: Response) {
  try {
    res.json({ remix: await getRemixFor(String(req.params.id), req.user?.userId) });
  } catch (e) {
    replyWithError(res, "remix_get_failed", e);
  }
}

/** GET /remixes/:id/scores?limit= → the remix's board, same rows as GET /scores/:gameId. */
export async function listRemixScores(req: Request, res: Response) {
  try {
    res.json(await getRemixLeaderboard(String(req.params.id), leaderboardLimit(req.query.limit)));
  } catch (e) {
    replyWithError(res, "remix_scores_failed", e);
  }
}
