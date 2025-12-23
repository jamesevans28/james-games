import Phaser from "phaser";
import { MainScene } from "./scenes/MainScene";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;

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
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
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
