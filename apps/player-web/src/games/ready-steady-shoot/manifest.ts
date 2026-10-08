import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "ready-steady-shoot",
  title: "Ready Steady Shoot",
  tagline: "Aim, pick your power and shoot for the hoop.",
  description:
    "Hold to pick angle, hold to pick power, then release to shoot. Swish for 2 points! 3 lives.",
  objective: "Shoot the basketball into the hoop by adjusting angle and power.",
  controls: "Hold to aim, release to set power and shoot.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["drag"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 25.0 },
  cover: "/assets/ready-steady-shoot/thumbnail.svg",
  createdAt: "2025-11-05T00:00:00.000Z",
  updatedAt: "2025-11-25T00:00:00.000Z",
  seo: {
    description: "Aim, pick your power and shoot for the hoop. A free basketball game, no ads.",
    category: "sports",
  },
});
