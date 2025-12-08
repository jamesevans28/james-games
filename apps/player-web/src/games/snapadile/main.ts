import Phaser from "phaser";
import SnapadileScene from "./SnapadileScene";

export default function StartSnapadileGame(parent: string) {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#000000",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 540,
      height: 960,
    },
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    scene: [SnapadileScene],
    render: { pixelArt: false, antialias: true },
  };

  return new Phaser.Game(config);
}
