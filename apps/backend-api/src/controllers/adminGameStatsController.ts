import type { Request, Response } from "express";
import { getGameStats } from "../services/gameStatsService.js";
import { sendServerError } from "../lib/http.js";

export async function show(req: Request, res: Response) {
  const gameId = String(req.params.gameId);
  if (!gameId) return res.status(400).json({ error: "gameId_required" });
  try {
    const stats = await getGameStats(gameId);
    res.json(stats);
  } catch (err: any) {
    sendServerError(res, "admin_game_stats_failed", err);
  }
}
