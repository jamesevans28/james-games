/**
 * The game registry (T4.8): every folder in src/games with a manifest.ts is a
 * game. Manifests load eagerly (they're small, no Phaser); a game's code loads
 * only when it is played. Adding a game = adding a folder.
 */
import type { GameManifest, GameModule, GameStatus } from "./sdk";

/** Pre-SDK games: mount into a container and report via the window event bus. */
export type LegacyGameModule = { mount: (container: HTMLElement) => { destroy: () => void } };
export type AnyGameModule = LegacyGameModule | GameModule;

export const isSdkModule = (mod: AnyGameModule): mod is GameModule => "create" in mod;

const manifestModules = import.meta.glob<{ default: GameManifest }>("../games/*/manifest.ts", {
  eager: true,
});
const codeLoaders = import.meta.glob<AnyGameModule>("../games/*/index.ts");

/** Every game, newest update first, including inactive ones. */
export const allManifests: readonly GameManifest[] = Object.values(manifestModules)
  .map((m) => m.default)
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));

export function getManifest(id: string): GameManifest | undefined {
  return allManifests.find((m) => m.id === id);
}

/** Loads a game's code on demand. */
export function loadGame(id: string): Promise<AnyGameModule> {
  const loader = codeLoaders[`../games/${id}/index.ts`];
  if (!loader) return Promise.reject(new Error(`unknown game ${id}`));
  return loader();
}

/** Who sees a game in lists: active for everyone, beta for beta testers, inactive for nobody. */
export function isListed(status: GameStatus, betaTester: boolean): boolean {
  return status === "active" || (status === "beta" && betaTester);
}
