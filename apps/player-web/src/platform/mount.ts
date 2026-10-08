import Phaser from "phaser";
import type { PlatformHost } from "./host";
import type { GameHost, GameInstance } from "./sdk";
import { controlGame } from "./controller";

const HOST_KEY = "host";

/** A scene's host, injected into the game registry by createGameMount. */
export function getHost(scene: Phaser.Scene): GameHost {
  const host: unknown = scene.registry.get(HOST_KEY);
  if (!host) throw new Error(`Scene ${scene.scene.key} has no host: mount it with createGameMount`);
  return host as GameHost;
}

export type MountOptions = {
  scenes: Phaser.Types.Scenes.SceneType[];
  physics?: Phaser.Types.Core.PhysicsConfig;
  backgroundColor?: string;
};

/**
 * Creates the Phaser game for a manifest inside `el`. Games call this from their
 * `create(host, el)`; the returned instance is driven by PlayGame.
 */
export function createGameMount(
  host: PlatformHost | GameHost,
  el: HTMLElement,
  options: MountOptions,
): GameInstance {
  const platformHost = host as PlatformHost;
  const { w, h } = host.manifest.design;
  let game: Phaser.Game | null = null;

  const boot = () => {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      width: w,
      height: h,
      parent: el,
      transparent: !options.backgroundColor,
      backgroundColor: options.backgroundColor,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: w, height: h },
      physics: options.physics,
      scene: options.scenes,
      callbacks: { preBoot: (g) => g.registry.set(HOST_KEY, host) },
    });
    game.sound.mute = host.audio.muted;
    // Dev only: lets the Browser pane (and Claude) inspect the running game.
    if (import.meta.env.DEV) {
      (window as unknown as { __g4jGame?: Phaser.Game }).__g4jGame = game;
    }
  };

  return controlGame(() => game, platformHost, boot);
}
