import Phaser from "phaser";
import PaddlePopScene from "./scene.ts";

export function mount(container: HTMLElement) {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 540,
    height: 960,
    parent: container,
    transparent: true,
    input: {
      activePointers: 3,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 540,
      height: 960,
    },
    scene: [PaddlePopScene],
  };

  const game = new Phaser.Game(config);

  return {
    destroy: () => game.destroy(true),
  };
}

export default {};
