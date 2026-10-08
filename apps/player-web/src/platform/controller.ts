import type { PlatformHost } from "./host";
import type { GameInstance } from "./sdk";

/** The parts of Phaser.Game the controller needs; lets tests use a fake game. */
type SceneControl = {
  isActive(): boolean;
  isPaused(): boolean;
  pause(): unknown;
  resume(): unknown;
  restart(): unknown;
};
export type GameLike = {
  scene: { getScenes(isActive?: boolean): Array<{ scene: SceneControl }> };
  sound: { mute: boolean; pauseAll(): void; resumeAll(): void };
  destroy(removeCanvas: boolean): void;
};

/** Turns a running Phaser game into a GameInstance (pure; tested with a fake game). */
export function controlGame(
  getGame: () => GameLike | null,
  host: PlatformHost,
  boot: () => void,
): GameInstance {
  let destroyed = false;
  const live = () => (destroyed ? null : getGame());
  const runningScenes = (game: GameLike) =>
    game.scene.getScenes(false).filter((s) => s.scene.isActive() || s.scene.isPaused());

  return {
    start() {
      if (destroyed) return;
      host.beginRun();
      if (!getGame()) boot();
    },
    pause() {
      const game = live();
      if (!game || host.isPaused()) return;
      host.setPaused(true);
      game.scene.getScenes(true).forEach((s) => s.scene.pause());
      game.sound.pauseAll();
    },
    resume() {
      const game = live();
      if (!game || !host.isPaused()) return;
      game.scene.getScenes(false).forEach((s) => {
        if (s.scene.isPaused()) s.scene.resume();
      });
      game.sound.resumeAll();
      host.setPaused(false);
    },
    restart() {
      const game = live();
      if (!game) return;
      host.setPaused(false);
      host.beginRun();
      // Same Phaser.Game, same WebGL context: only the scenes start over.
      runningScenes(game).forEach((s) => s.scene.restart());
      game.sound.resumeAll();
    },
    destroy() {
      const game = live();
      destroyed = true;
      game?.destroy(true);
    },
    setMuted(muted) {
      const game = live();
      if (game) game.sound.mute = muted;
    },
  };
}
