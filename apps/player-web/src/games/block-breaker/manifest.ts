import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "block-breaker",
  title: "Block Breaker",
  tagline: "Smash every brick with your ball.",
  description: "A classic brick-breaking game. Clear all the bricks to win.",
  objective: "Break all the bricks with the ball.",
  controls: "Move the paddle with the mouse.",
  makers: [...brand.makers],
  status: "beta",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["drag"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 1.5 },
  cover: "/assets/block-breaker/thumbnail.svg",
  createdAt: "2025-12-01T00:00:00.000Z",
  updatedAt: "2025-12-01T00:00:00.000Z",
  seo: {
    description:
      "Smash every brick with your ball. The classic brick breaker, free and with no ads.",
    category: "arcade",
  },
});
