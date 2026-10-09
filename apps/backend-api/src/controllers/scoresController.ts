import type { Request, Response } from "express";
import { getLeaderboard, submitScore } from "../services/scoresService.js";
import { ScoreRejected, isValidGameId } from "../services/scoringRules.js";
import { leaderboardLimit, leaderboardScope } from "../services/leaderboardRules.js";
import { log } from "../lib/log.js";
import { sendServerError } from "../lib/http.js";

/**
 * POST /scores — the only way a run earns anything. The client sends
 * { gameId, score, durationMs?, tzOffsetMinutes?, playId?, daily? }; the server validates the
 * score against the game's limits and awards XP from the game's multiplier.
 */
export async function createScore(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  const body = (req.body || {}) as {
    gameId?: unknown;
    score?: unknown;
    durationMs?: unknown;
    tzOffsetMinutes?: unknown;
    playId?: unknown;
    daily?: unknown;
    remixId?: unknown; // T11.2
  };
  try {
    const result = await submitScore(userId, body);
    res.json({
      ok: true,
      gameId: result.gameId,
      playId: result.playId, // T11.5 share link
      score: result.score,
      createdAt: result.createdAt,
      // `awardedXp` is the name the player app reads; `xpAwarded` matches the plan (T6.3).
      awardedXp: result.xpAwarded,
      xpAwarded: result.xpAwarded,
      newBest: result.newBest,
      ...(result.newLevel !== undefined ? { newLevel: result.newLevel } : {}),
      summary: result.summary,
      streak: result.streak,
      ...(result.stickerEarned ? { stickerEarned: result.stickerEarned } : {}),
      stickersEarned: result.stickersEarned ?? [],
      ...(result.daily ? { daily: result.daily } : {}),
      ...(result.duplicate ? { duplicate: true } : {}),
    });
  } catch (e) {
    if (e instanceof ScoreRejected) {
      log.warn("score_rejected", {
        code: e.code,
        gameId: isValidGameId(body.gameId) ? body.gameId : undefined,
      });
      return res.status(e.status).json({ error: e.code });
    }
    sendServerError(res, "score_create_failed", e);
  }
}

/**
 * GET /scores/:gameId?limit=&scope=following — best score per player, highest
 * first. The following board (sign-in required) is the viewer plus the players
 * they follow.
 */
export async function listScores(req: Request, res: Response) {
  try {
    const gameId = String(req.params.gameId);
    const limit = leaderboardLimit(req.query.limit);
    let friendsOf: string | undefined;
    if (leaderboardScope(req.query.scope) === "following") {
      friendsOf = req.user?.userId;
      if (!friendsOf) return res.status(401).json({ error: "unauthorized" });
    }
    if (!isValidGameId(gameId)) return res.json([]);
    res.json(await getLeaderboard(gameId, limit, { friendsOf }));
  } catch (e) {
    sendServerError(res, "scores_list_failed", e);
  }
}
