import type { Game } from "../db/schema.js";
import { getGame, listGames, updateGameMetadata, type GameStatus } from "../repos/gamesRepo.js";
import { getUserById } from "../repos/usersRepo.js";
import { clearFeedCache } from "./feedService.js";

/**
 * Game config. Rows are seeded from the manifests on every deploy (title, status,
 * scoring); the only admin-editable field is `metadata` (featured, campaigns, promo text).
 */

/** The shape GET /games/config returns (player-web useGameCatalog reads it). */
export type GameConfig = {
  gameId: string;
  title: string;
  description: string | null;
  status: GameStatus;
  betaOnly: boolean;
  xpMultiplier: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminGameConfig = GameConfig & { maxScore: number; maxScorePerSecond: number };

const MAX_METADATA_BYTES = 16_384;

export function toGameConfig(row: Game): GameConfig {
  return {
    gameId: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    betaOnly: row.status === "beta",
    xpMultiplier: row.xpMultiplier,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAdminGameConfig(row: Game): AdminGameConfig {
  return { ...toGameConfig(row), maxScore: row.maxScore, maxScorePerSecond: row.maxScorePerSecond };
}

/** Beta testers see beta games; nobody sees inactive ones outside the admin. */
export async function visibleStatuses(viewerId?: string): Promise<GameStatus[]> {
  if (!viewerId) return ["active"];
  const viewer = await getUserById(viewerId);
  return viewer?.betaTester ? ["active", "beta"] : ["active"];
}

export async function listVisibleGameConfigs(viewerId?: string): Promise<GameConfig[]> {
  const rows = await listGames(await visibleStatuses(viewerId));
  return rows.map(toGameConfig);
}

export async function getVisibleGameConfig(
  gameId: string,
  viewerId?: string,
): Promise<GameConfig | null> {
  const row = await getGame(gameId);
  if (!row) return null;
  const statuses = await visibleStatuses(viewerId);
  return statuses.includes(row.status) ? toGameConfig(row) : null;
}

export async function listAllGameConfigs(): Promise<AdminGameConfig[]> {
  return (await listGames()).map(toAdminGameConfig);
}

export async function getAdminGameConfig(gameId: string): Promise<AdminGameConfig | null> {
  const row = await getGame(gameId);
  return row ? toAdminGameConfig(row) : null;
}

export type MetadataUpdateResult =
  { ok: true; game: AdminGameConfig } | { ok: false; status: 400 | 404; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Admin edit: the body must be exactly `{ metadata: object | null }`. */
export async function updateGameMetadataFromAdmin(
  gameId: string,
  body: unknown,
): Promise<MetadataUpdateResult> {
  if (!isPlainObject(body) || !("metadata" in body)) {
    return { ok: false, status: 400, error: "metadata_required" };
  }
  if (Object.keys(body).some((key) => key !== "metadata")) {
    return { ok: false, status: 400, error: "only_metadata_editable" };
  }
  const { metadata } = body;
  if (metadata !== null && !isPlainObject(metadata)) {
    return { ok: false, status: 400, error: "invalid_metadata" };
  }
  if (JSON.stringify(metadata).length > MAX_METADATA_BYTES) {
    return { ok: false, status: 400, error: "metadata_too_large" };
  }
  const row = await updateGameMetadata(gameId, metadata);
  if (!row) return { ok: false, status: 404, error: "game_not_found" };
  clearFeedCache();
  return { ok: true, game: toAdminGameConfig(row) };
}
