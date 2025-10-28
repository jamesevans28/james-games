import Phaser from "phaser";
import ReflexRingGame from "./ReflexRingGame";

export function mount(container: HTMLElement) {
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
    scene: [ReflexRingGame],
  };

  const game = new Phaser.Game(config);

  return {
    destroy: () => {
      game.destroy(true);
    },
  };
}

export default {};
