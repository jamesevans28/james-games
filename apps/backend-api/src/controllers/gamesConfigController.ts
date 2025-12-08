import type { Request, Response } from "express";
import {
  listGameConfigs,
  getGameConfig,
  createGameConfig,
  updateGameConfig,
} from "../services/gamesConfigService.js";

export async function list(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const result = await listGameConfigs({ limit, cursor });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed_to_list_games" });
  }
}

export async function show(req: Request, res: Response) {
  const { gameId } = req.params;
  if (!gameId) return res.status(400).json({ error: "gameId_required" });
  try {
    const game = await getGameConfig(gameId);
    if (!game) return res.status(404).json({ error: "game_not_found" });
    res.json(game);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed_to_get_game" });
  }
}

export async function create(req: Request, res: Response) {
  const body = req.body || {};
  try {
    const created = await createGameConfig(body);
    res.status(201).json(created);
  } catch (err: any) {
    const code = err?.message === "gameId_and_title_required" ? 400 : 500;
    res.status(code).json({ error: err?.message || "failed_to_create_game" });
  }
}

export async function update(req: Request, res: Response) {
  const { gameId } = req.params;
  if (!gameId) return res.status(400).json({ error: "gameId_required" });
  const body = req.body || {};
  try {
    const updated = await updateGameConfig(gameId, body);
    res.json(updated);
  } catch (err: any) {
    const code = err?.message === "no_fields_to_update" ? 400 : 500;
    res.status(code).json({ error: err?.message || "failed_to_update_game" });
  }
}
