import type { Request, Response } from "express";
import {
  putScoreWithUser,
  getTopScoresHydrated,
  validateScoreInput,
} from "../services/scoresService.js";

export async function createScore(req: Request, res: Response) {
  try {
    const { gameId, score } = (req.body || {}) as any;
    const { gameId: g, score: s } = validateScoreInput(gameId, score);
    // @ts-ignore
    const userCtx = req.user || {};
    const item = await putScoreWithUser({
      gameId: g,
      score: s,
      userId: userCtx.userId,
      screenName: userCtx.screenName,
      avatar: userCtx.avatar,
    });
    res.json({ ok: true, gameId: item.gameId, score: item.score, createdAt: item.createdAt });
  } catch (e: any) {
    if (e.message?.includes("required") || e.message?.includes("number")) {
      return res.status(400).json({ error: e.message });
    }
    res.status(500).json({ error: e?.message || "Server error" });
  }
}

export async function listScores(req: Request, res: Response) {
  try {
    const gameId = String((req.params as any).gameId);
    const limitRaw = Number((req.query as any).limit) || 10;
    const limit = Math.min(50, Math.max(1, limitRaw));
    const rows = await getTopScoresHydrated(gameId, limit);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Server error" });
  }
}
