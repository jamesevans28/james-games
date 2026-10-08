import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "fill-the-cup",
  title: "Fill the Cup",
  tagline: "Hold to pour, let go to stop. Don't spill!",
  description:
    "Hold to pour water and fill each glass to the highlighted band. Smaller targets over time.",
  objective: "Fill the glass to the target line without overflowing or underfilling.",
  controls: "Hold screen to pour, release to stop.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["hold"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 3.0 },
  cover: "/assets/fill-the-cup/thumbnail.svg",
  createdAt: "2025-11-01T00:00:00.000Z",
  updatedAt: "2025-11-25T00:00:00.000Z",
  seo: {
    description:
      "Hold to pour, let go to stop. Fill each glass to the line without spilling. Free, no ads.",
    category: "casual",
  },
});
