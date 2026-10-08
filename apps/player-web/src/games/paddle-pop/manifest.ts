import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "paddle-pop",
  title: "Paddle Pop",
  tagline: "Bounce the ball, smash the targets, grab power-ups.",
  description: "Deflect the marble, collect power-ups, hit bonus discs, avoid falling obstacles.",
  objective: "Keep the ball in the air and hit targets.",
  controls: "Drag the paddle left and right.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["hold"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 5.13 },
  cover: "/assets/paddle-pop/paddlepop.jpg",
  createdAt: "2025-11-05T00:00:00.000Z",
  updatedAt: "2025-12-29T00:00:00.000Z",
  seo: {
    description:
      "Bounce the ball, hit the targets, grab the power-ups. A free paddle game, no ads.",
    category: "arcade",
  },
});
