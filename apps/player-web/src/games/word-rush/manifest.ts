import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "word-rush",
  title: "Word Rush",
  tagline: "Guess the hidden words before the clock runs out.",
  description:
    "Pick four consonants and two vowels, then guess the hidden word or phrase before the clock runs out. Animals, food, places, kids' films and more.",
  objective:
    "Solve each hidden word or phrase before the timer runs out. You score a point for every second left on the clock.",
  controls:
    "Tap 4 consonants and 2 vowels, then Start. Type the answer on the on-screen keyboard (or a real keyboard) and tap Submit. Buy Letter shows a hidden letter for 30 seconds; Give Up ends the game.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap", "keyboard"],
  // A solve scores the seconds left: at most 120 (levels 1–3 have 2 minutes). The
  // quickest possible level is about 3.4 s (0.4 s reveal, ~1 s to type "UP" and
  // submit, 2 s before the next board), so ~35 points/s is the ceiling; 60 leaves
  // a margin. A great run is 20 levels at ~80 points (1,600); max leaves lots of room.
  scoring: { max: 20_000, perSecondMax: 60, xpMultiplier: 1.42 },
  cover: "/assets/word-rush/thumbnail.svg",
  createdAt: "2025-11-05T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
  seo: {
    description:
      "Pick your letters, then guess the hidden words before the clock runs out. Free word game, no ads.",
    category: "word",
  },
});
