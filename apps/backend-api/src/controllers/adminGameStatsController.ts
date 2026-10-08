import type { Request, Response } from "express";
import { getGameStats } from "../services/gameStatsService.js";

/** GET /admin/games/:gameId/stats */
export async function show(req: Request, res: Response) {
  const stats = await getGameStats(String(req.params.gameId));
  if (!stats) return res.status(404).json({ error: "game_not_found" });
  res.json(stats);
}
