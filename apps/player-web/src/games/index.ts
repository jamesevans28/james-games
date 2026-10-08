/**
 * Thin view of the manifest registry (platform/registry.ts) in the shape the
 * pages already use. Don't add games here: add a folder with a manifest.ts.
 */
import { allManifests, isSdkModule, loadGame, type AnyGameModule } from "../platform/registry";
import type { GameManifest, GameStatus } from "../platform/sdk";

export { isSdkModule };
export type { LegacyGameModule } from "../platform/registry";

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
  load: () => Promise<AnyGameModule>;
};

export function toGameMeta(m: GameManifest): GameMeta {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    objective: m.objective,
    controls: m.controls,
    thumbnail: m.cover,
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
