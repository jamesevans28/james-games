import type { Request, Response } from "express";
import { putScoreWithUser, getTopScoresHydrated } from "../services/scoresService.js";
import { getFollowingIds } from "../services/followersService.js";
import { getGameConfig } from "../services/gamesConfigService.js";
import { getUser } from "../services/dynamoService.js";
import { applyExperienceToUser } from "../services/experienceService.js";
import {
  ScoreRejected,
  limitsFor,
  multiplierFor,
  validateScoreSubmission,
  xpForScore,
} from "../services/scoringRules.js";
import { log } from "../lib/log.js";
import { sendServerError } from "../lib/http.js";

/**
 * POST /scores — the only way a run earns anything. The server validates the score
 * against its own limits and awards XP from its own multiplier; the client sends
 * only { gameId, score, durationMs? }.
 */
export async function createScore(req: Request, res: Response) {
  const body = (req.body || {}) as { gameId?: unknown; score?: unknown; durationMs?: unknown };
  try {
    const gameConfig =
      typeof body.gameId === "string" ? await getGameConfig(body.gameId).catch(() => null) : null;
    const valid = validateScoreSubmission(body, limitsFor(gameConfig));

    const userId = req.user?.userId;
    // Name/avatar snapshots come from the user row (req.user only carries auth claims).
    const profile = userId ? await getUser(userId).catch(() => null) : null;
    const item = await putScoreWithUser({
      gameId: valid.gameId,
      score: valid.score,
      durationMs: valid.durationMs,
      userId,
      screenName: typeof profile?.screenName === "string" ? profile.screenName : undefined,
      avatar: typeof profile?.avatar === "number" ? profile.avatar : undefined,
    });

    let awardedXp = 0;
    let summary = null;
    if (userId && valid.score > 0) {
      try {
        const xp = xpForScore(valid.score, multiplierFor(gameConfig));
        const result = await applyExperienceToUser(userId, xp);
        awardedXp = result.awarded;
        summary = result.summary;
      } catch (err: any) {
        // The score is saved; an XP failure must not lose it.
        log.warn("xp_award_failed", { gameId: valid.gameId }, err);
      }
    }

    res.json({
      ok: true,
      gameId: item.gameId,
      score: item.score,
      createdAt: item.createdAt,
      awardedXp,
      summary,
    });
  } catch (e: any) {
    if (e instanceof ScoreRejected) {
      log.warn("score_rejected", { code: e.code });
      return res.status(400).json({ error: e.code });
    }
    log.error("score_create_failed", undefined, e);
    res.status(500).json({ error: "server_error" });
  }
}

export async function listScores(req: Request, res: Response) {
  try {
    const gameId = String((req.params as any).gameId);
    const limitRaw = Number((req.query as any).limit) || 10;
    const limit = Math.min(50, Math.max(1, limitRaw));
    const scope = String((req.query as any)?.scope || "");
    let includeUserIds: string[] | undefined;
    if (scope === "following") {
      const userId = req.user?.userId as string | undefined;
      if (!userId) return res.status(401).json({ error: "unauthorized" });
      const followingIds = await getFollowingIds(userId);
      const allow = new Set<string>(followingIds);
      allow.add(userId);
      includeUserIds = Array.from(allow);
    }
    const rows = await getTopScoresHydrated(gameId, limit, { includeUserIds });
    res.json(rows);
  } catch (e: any) {
    sendServerError(res, "scores_list_failed", e);
  }
}
