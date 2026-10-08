import type { Request, Response } from "express";
import {
  getAdminGameConfig,
  getVisibleGameConfig,
  listAllGameConfigs,
  listVisibleGameConfigs,
  updateGameMetadataFromAdmin,
} from "../services/gamesConfigService.js";

// The catalogue is a few dozen games, so lists come back whole (no nextCursor).

/** GET /games/config: active games, plus beta games for a signed-in beta tester. */
export async function list(req: Request, res: Response) {
  res.json({ items: await listVisibleGameConfigs(req.user?.userId) });
}

/** GET /games/config/:gameId */
export async function show(req: Request, res: Response) {
  const game = await getVisibleGameConfig(String(req.params.gameId), req.user?.userId);
  if (!game) return res.status(404).json({ error: "game_not_found" });
  res.json(game);
}

/** GET /admin/games: every game, inactive included. */
export async function adminList(_req: Request, res: Response) {
  res.json({ items: await listAllGameConfigs() });
}

/** GET /admin/games/:gameId */
export async function adminShow(req: Request, res: Response) {
  const game = await getAdminGameConfig(String(req.params.gameId));
  if (!game) return res.status(404).json({ error: "game_not_found" });
  res.json(game);
}

/** PATCH|PUT|POST /admin/games/:gameId with `{ metadata }`; everything else comes from the manifests. */
export async function adminUpdate(req: Request, res: Response) {
  const result = await updateGameMetadataFromAdmin(String(req.params.gameId), req.body);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json(result.game);
}
