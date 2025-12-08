import type { Request, Response } from "express";
import { getGameStats } from "../services/gameStatsService.js";

export async function show(req: Request, res: Response) {
  const { gameId } = req.params;
  if (!gameId) return res.status(400).json({ error: "gameId_required" });
  try {
    const stats = await getGameStats(gameId);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed_to_get_game_stats" });
  }
}
