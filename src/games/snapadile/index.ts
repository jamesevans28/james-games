import Phaser from "phaser";
import SnapadileScene from "./SnapadileScene";

// Mount API to match the games hub contract
export function mount(container: HTMLElement) {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 540,
    height: 960,
    parent: container,
    backgroundColor: "#000000",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 540,
      height: 960,
    },
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    scene: [SnapadileScene],
    render: { pixelArt: false, antialias: true },
  };

  const game = new Phaser.Game(config);

  return {
    destroy: () => game.destroy(true),
  };
}

export default {};
