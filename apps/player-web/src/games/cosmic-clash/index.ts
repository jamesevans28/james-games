import Phaser from "phaser";
import CosmicClashGame from "./CosmicClashGame";
import { trackGameStart } from "../../utils/analytics";

export function mount(container: HTMLElement): { destroy: () => void } {
  trackGameStart("cosmic-clash", "Cosmic Clash");

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 540,
    height: 960,
    parent: container,
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 540,
      height: 960,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [CosmicClashGame],
  };

  const game = new Phaser.Game(config);

  return {
    destroy: () => {
      game.destroy(true);
    },
  };
}
