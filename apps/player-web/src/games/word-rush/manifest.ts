import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "word-rush",
  title: "Word Rush",
  tagline: "Guess the hidden words before the clock runs out.",
  description: "Guess words and phrases with your selected letters. 2-minute timer per level!",
  objective: "Solve the word puzzle before time runs out.",
  controls: "Tap letters to guess the word.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap", "keyboard"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 1.42 },
  cover: "/assets/word-rush/thumbnail.svg",
  createdAt: "2025-11-05T00:00:00.000Z",
  updatedAt: "2025-11-25T00:00:00.000Z",
  seo: {
    description:
      "Pick your letters, then guess the hidden words before the clock runs out. Free word game, no ads.",
    category: "word",
  },
});
