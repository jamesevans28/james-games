import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "serpento",
  title: "Serpento",
  tagline: "Eat, grow, and don't bite your own tail.",
  description:
    "Classic snake game. Turn left/right to collect food, avoid walls and yourself. Gets faster as you grow!",
  objective: "Eat food to grow longer, avoid hitting walls or yourself.",
  controls: "Tap left or right side of screen to turn.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["swipe", "dpad", "keyboard"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 18.5 },
  cover: "/assets/serpento/thumbnail.svg",
  createdAt: "2025-11-17T00:00:00.000Z",
  updatedAt: "2025-11-25T00:00:00.000Z",
  seo: {
    description:
      "Eat to grow, don't hit the walls (or yourself). Our take on the classic snake game. Free, no ads.",
    category: "arcade",
  },
});
