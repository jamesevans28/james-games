import Phaser from "phaser";
import HoHoHomeDeliveryGame from "./HoHoHomeDeliveryGame.ts";

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
    physics: {
      default: "arcade",
      arcade: {
        // reduced gravity so presents fall slower and spin feels weighty
        gravity: { x: 0, y: 700 },
        debug: false,
      },
    },
    scene: [HoHoHomeDeliveryGame],
  };

  const game = new Phaser.Game(config);

  return {
    destroy: () => {
      game.destroy(true);
    },
  };
}

export default {};
