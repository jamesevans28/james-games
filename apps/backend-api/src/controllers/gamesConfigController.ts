/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment -- TODO T6.3: untyped DynamoDB items; the Drizzle repository layer gives these real row types */
import type { Request, Response } from "express";
import {
  listGameConfigs,
  getGameConfig,
  createGameConfig,
  updateGameConfig,
} from "../services/gamesConfigService.js";
import { sendServerError } from "../lib/http.js";
import { errorInfo } from "../lib/errors.js";

export async function list(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const result = await listGameConfigs({ limit, cursor });
    res.json(result);
  } catch (err) {
    sendServerError(res, "game_config_list_failed", err);
  }
}

export async function show(req: Request, res: Response) {
  const gameId = String(req.params.gameId);
  if (!gameId) return res.status(400).json({ error: "gameId_required" });
  try {
    const game = await getGameConfig(gameId);
    if (!game) return res.status(404).json({ error: "game_not_found" });
    res.json(game);
  } catch (err) {
    sendServerError(res, "game_config_get_failed", err);
  }
}

export async function create(req: Request, res: Response) {
  const body = req.body || {};
  try {
    const created = await createGameConfig(body);
    res.status(201).json(created);
  } catch (err) {
    if (errorInfo(err).message === "gameId_and_title_required") {
      return res.status(400).json({ error: "gameId_and_title_required" });
    }
    sendServerError(res, "admin_create_game_failed", err);
  }
}

export async function update(req: Request, res: Response) {
  const gameId = String(req.params.gameId);
  if (!gameId) return res.status(400).json({ error: "gameId_required" });
  const body = req.body || {};
  try {
    const updated = await updateGameConfig(gameId, body);
    res.json(updated);
  } catch (err) {
    if (errorInfo(err).message === "no_fields_to_update") {
      return res.status(400).json({ error: "no_fields_to_update" });
    }
    sendServerError(res, "admin_update_game_failed", err);
  }
}
