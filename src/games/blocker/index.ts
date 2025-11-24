import Phaser from "phaser";
import BlockerGame from "./BlockerGame";
import { trackGameStart } from "../../utils/analytics";

const CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 540,
  height: 960,
  backgroundColor: "#000000",
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 540,
    height: 960,
  },
  scene: [BlockerGame],
};

export function mount(container: HTMLElement): { destroy: () => void } {
  trackGameStart("blocker", "Blocker");

  const game = new Phaser.Game({ ...CONFIG, parent: container });

  return {
    destroy: () => {
      game.destroy(true);
    },
  };
}
