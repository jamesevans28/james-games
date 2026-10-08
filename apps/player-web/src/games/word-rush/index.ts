import type { CreateGame } from "../../platform/sdk";
import { createGameMount } from "../../platform/mount";
import LetterSelectionScene from "./scenes/LetterSelectionScene";
import WordRushGameScene from "./scenes/WordRushGameScene";

export { default as manifest } from "./manifest";

// Letter picking first, then the puzzles. "Play again" restarts the puzzle scene
// with the same letters.
export const create: CreateGame = (host, el) =>
  createGameMount(host, el, { scenes: [LetterSelectionScene, WordRushGameScene] });
