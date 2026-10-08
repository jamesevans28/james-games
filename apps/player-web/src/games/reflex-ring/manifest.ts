import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "reflex-ring",
  title: "Reflex Ring",
  tagline: "Tap when the arrow hits the bright segment.",
  description: "Tap precisely as the arrow hits the highlighted segment. Speeds up over time.",
  objective: "Tap the screen exactly when the rotating arrow overlaps with the colored segment.",
  controls: "Tap anywhere on the screen.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  // 1 point a hit, 2 for a perfect one; a hit takes well over 200 ms.
  scoring: { max: 10_000, perSecondMax: 10, xpMultiplier: 2.92 },
  cover: "/assets/reflex-ring/thumbnail.svg",
  createdAt: "2025-09-15T00:00:00.000Z",
  updatedAt: "2025-11-26T00:00:00.000Z",
  seo: {
    description:
      "Tap when the arrow hits the bright segment. It speeds up every round. Free, no ads.",
    category: "reflex",
  },
});
