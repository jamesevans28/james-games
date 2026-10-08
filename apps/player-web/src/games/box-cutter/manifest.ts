import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "box-cutter",
  title: "Box Cutter",
  tagline: "Draw lines to box off the board. Dodge the fireball!",
  description: "Draw lines to capture territory while avoiding the bouncing enemy ball.",
  objective: "Capture 75% of the screen by drawing enclosed areas without getting hit.",
  controls: "Use the on-screen directional pad to move your sparkly ball.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["dpad", "swipe"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 0.03 },
  cover: "/assets/box-cutter/boxcutter.jpg",
  createdAt: "2025-12-23T00:00:00.000Z",
  updatedAt: "2025-12-23T00:00:00.000Z",
  seo: {
    description:
      "Draw lines to box off the board while dodging the fireball. Free, no ads, very satisfying.",
    category: "arcade",
  },
});
