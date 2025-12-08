import Phaser from "phaser";
import LetterSelectionScene from "./LetterSelectionScene";
import WordRushGameScene from "./WordRushGameScene";
import { trackGameStart } from "../../utils/analytics";

const GAME_ID = "word-rush";
const GAME_TITLE = "Word Rush with Tom";

export function mount(container: HTMLElement) {
  trackGameStart(GAME_ID, GAME_TITLE);

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 540,
    height: 960,
    parent: container,
    transparent: true,
    antialias: true,
    antialiasGL: true,
    render: {
      antialias: true,
      antialiasGL: true,
      roundPixels: false,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 540,
      height: 960,
    },
    scene: [LetterSelectionScene, WordRushGameScene],
  };

  const game = new Phaser.Game(config);

  return {
    destroy: () => game.destroy(true),
  };
}

export default {};
