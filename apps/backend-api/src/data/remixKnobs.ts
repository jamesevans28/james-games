/**
 * Remix knob ranges per game (T11.2), straight from the exported manifests.
 *
 * The manifests own the knobs, and games.metadata belongs to the admin, so the API
 * bundles apps/player-web/public/game-meta.json instead of copying the ranges into
 * the database: esbuild inlines the JSON into lambda.mjs, and tsx/vitest read it
 * from disk. A manifest change reaches the server with the next API deploy.
 */
import gameMeta from "../../../player-web/public/game-meta.json" with { type: "json" };
import type { ManifestRow, RemixKnob } from "../db/seedData.js";

export type { RemixKnob };

const BY_GAME = new Map<string, readonly RemixKnob[]>(
  (gameMeta as unknown as ManifestRow[])
    .filter((m) => Array.isArray(m.remix) && m.remix.length > 0)
    .map((m) => [m.id, m.remix ?? []]),
);

/** The knobs a game can be remixed with; empty when it has none. */
export function remixKnobsFor(gameId: string): readonly RemixKnob[] {
  return BY_GAME.get(gameId) ?? [];
}
