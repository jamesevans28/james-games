import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "flash-bash",
  title: "Flash Bash",
  tagline: "Watch the lights, then copy the pattern.",
  description:
    "Watch the sequence of colored shapes, then mimic them before time runs out. Sequences get longer!",
  objective: "Memorize and repeat the sequence of flashing colors.",
  controls: "Tap the colored buttons in the correct order.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 4.13 },
  cover: "/assets/flash-bash/thumbnail.svg",
  createdAt: "2025-11-04T00:00:00.000Z",
  updatedAt: "2025-11-25T00:00:00.000Z",
  seo: {
    description:
      "Watch the lights, then copy the pattern. How long a sequence can you remember? Free memory game, no ads.",
    category: "memory",
  },
});
