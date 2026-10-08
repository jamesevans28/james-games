import Phaser from "phaser";
import BlockBreakerScene from "./BlockBreakerScene";

export const mount = (container: HTMLElement) => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 540,
    height: 960,
    parent: container,
    transparent: true,
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 540,
      height: 960,
    },
    scene: [BlockBreakerScene],
  };

  const game = new Phaser.Game(config);

  return {
    destroy: () => {
      game.destroy(true);
    },
  };
};
