import Phaser from "phaser";
import { MainScene } from "./scenes/MainScene";

// Optimized for most common mobile screens (9:16 aspect ratio)
// Scales up to tablet size, then caps at tablet dimensions
const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;
const MAX_WIDTH = 768; // Tablet width limit
const MAX_HEIGHT = 1366; // Tablet height limit

export interface GameInstance {
  destroy: () => void;
}

export function mount(container: HTMLElement): GameInstance {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: container,
    transparent: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      min: {
        width: 320,
        height: 568,
      },
      max: {
        width: MAX_WIDTH,
        height: MAX_HEIGHT,
      },
    },
    scene: [MainScene],
    backgroundColor: "#000000",
  };

  const game = new Phaser.Game(config);

  // Create particle texture (simple white pixel)
  game.events.once("ready", () => {
    const scene = game.scene.getScene("MainScene") as MainScene;
    const graphics = scene.add.graphics();
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(2, 2, 2);
    graphics.generateTexture("particle", 4, 4);
    graphics.destroy();
  });

  return {
    destroy: () => {
      game.destroy(true);
    },
  };
}
