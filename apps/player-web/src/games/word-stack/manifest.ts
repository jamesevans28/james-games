import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "word-stack",
  title: "Word Stack",
  tagline: "Swap one letter at a time to build a stack of words.",
  description:
    "Start with a 5-letter word, then drag offered letters to create new valid words. Six turns max.",
  objective: "Build a stack of valid 5-letter words using the offered letters.",
  controls: "Type your first word, then drag a letter tile onto the word.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["drag", "keyboard"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 1.0 },
  cover: "/assets/word-stack/thumbnail.svg",
  createdAt: "2025-12-26T00:00:00.000Z",
  updatedAt: "2025-12-26T00:00:00.000Z",
  seo: {
    description:
      "Start with one 5-letter word, then swap in letters to make new ones. Free word puzzle, no ads.",
    category: "word",
  },
});
