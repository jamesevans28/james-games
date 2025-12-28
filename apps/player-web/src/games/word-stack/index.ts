import Phaser from "phaser";
import WordStackScene from "./WordStackScene";

const PLAY_WIDTH = 540;
const PLAY_HEIGHT = 960;

export function mount(container: HTMLElement) {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: PLAY_WIDTH,
    height: PLAY_HEIGHT,
    parent: container,
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: PLAY_WIDTH,
      height: PLAY_HEIGHT,
    },
    scene: [WordStackScene],
  });

  return {
    destroy() {
      game.destroy(true);
    },
  };
}
