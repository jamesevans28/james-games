import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "cosmic-clash",
  title: "Cosmic Clash",
  tagline: "Blast the space invaders and survive the waves.",
  description:
    "Space Invaders-style shooter. Auto-fire at descending aliens, collect power-ups, survive waves!",
  objective: "Destroy waves of alien invaders.",
  controls: "Drag to move ship, it shoots automatically.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["hold", "tap", "keyboard"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 0.5 },
  cover: "/assets/cosmic-clash/thumbnail.svg",
  createdAt: "2025-11-21T00:00:00.000Z",
  updatedAt: "2025-11-25T00:00:00.000Z",
  seo: {
    description:
      "Blast the space invaders, grab power-ups and survive the waves. Free shooter, no ads.",
    category: "action",
  },
});
