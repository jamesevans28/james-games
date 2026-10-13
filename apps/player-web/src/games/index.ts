/**
 * Thin view of the manifest registry (platform/registry.ts) in the shape the
 * pages already use. Don't add games here: add a folder with a manifest.ts.
 */
import { allManifests, loadGame } from "../platform/registry";
import type { GameManifest, GameModule, GameStatus } from "../platform/sdk";

export type GameMeta = {
  id: string;
  title: string;
  description?: string;
  objective?: string;
  controls?: string;
  thumbnail?: string; // path under public
  xpMultiplier?: number; // display only; the server owns XP (T1.4)
  createdAt?: string; // ISO date
  updatedAt?: string; // ISO date
  status: GameStatus;
  betaOnly?: boolean; // status === "beta" (kept for the feed and catalog code)
  makers?: string[];
  note?: string;
  noteBy?: string;
  load: () => Promise<GameModule>;
};

/**
 * The image to show for a cover. `scripts/art/cover.mjs` writes cover.png (the
 * 1024 px master the art check requires) and a cover.webp beside it at about a
 * tenth of the size, so tiles and pages use the WebP.
 */
export function displayCover(cover: string): string {
  return cover.replace(/\/cover\.png$/, "/cover.webp");
}

export function toGameMeta(m: GameManifest): GameMeta {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    objective: m.objective,
    controls: m.controls,
    thumbnail: displayCover(m.cover),
    xpMultiplier: m.scoring.xpMultiplier,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    status: m.status,
    betaOnly: m.status === "beta",
    makers: m.makers,
    note: m.note,
    noteBy: m.noteBy,
    load: () => loadGame(m.id),
  };
}

/** Every game, including inactive ones (direct links still resolve). */
export const allGames: GameMeta[] = allManifests.map(toGameMeta);

/** Games that can appear in lists (active + beta; pages hide beta from non-testers). */
export const games: GameMeta[] = allGames.filter((g) => g.status !== "inactive");
