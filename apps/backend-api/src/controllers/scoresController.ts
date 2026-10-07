import type { Request, Response } from "express";
import { putScoreWithUser, getTopScoresHydrated } from "../services/scoresService.js";
import { getFollowingIds } from "../services/followersService.js";
import { getGameConfig } from "../services/gamesConfigService.js";
import { applyExperienceToUser } from "../services/experienceService.js";
import {
  ScoreRejected,
  limitsFor,
  multiplierFor,
  validateScoreSubmission,
  xpForScore,
} from "../services/scoringRules.js";

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

    // @ts-ignore req.user is set by requireAuth (typed properly in T1.8)
    const userCtx = req.user || {};
    const item = await putScoreWithUser({
      gameId: valid.gameId,
      score: valid.score,
      durationMs: valid.durationMs,
      userId: userCtx.userId,
      screenName: userCtx.screenName,
      avatar: userCtx.avatar,
    });

    let awardedXp = 0;
    let summary = null;
    if (userCtx.userId && valid.score > 0) {
      try {
        const xp = xpForScore(valid.score, multiplierFor(gameConfig));
        const result = await applyExperienceToUser(userCtx.userId, xp);
        awardedXp = result.awarded;
        summary = result.summary;
      } catch (err: any) {
        // The score is saved; an XP failure must not lose it.
        console.warn("createScore: xp award failed", err?.message);
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
      console.warn("createScore: rejected", e.code);
      return res.status(400).json({ error: e.code });
    }
    console.error("createScore: failed", e?.name);
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
      // @ts-ignore
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
    res.status(500).json({ error: e?.message || "Server error" });
  }
}
