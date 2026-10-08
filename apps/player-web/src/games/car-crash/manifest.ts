import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "car-crash",
  title: "Car Crash",
  tagline: "Switch lanes and dodge the traffic.",
  description: "Switch lanes to dodge incoming cars. Step-based movement with growing difficulty.",
  objective: "Dodge incoming traffic by switching lanes.",
  controls: "Tap left or right to switch lanes.",
  makers: [...brand.makers],
  status: "inactive",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 2.47 },
  cover: "/assets/car-crash/thumbnail.svg",
  createdAt: "2025-09-17T00:00:00.000Z",
  updatedAt: "2025-11-25T00:00:00.000Z",
  seo: {
    description:
      "Switch lanes and dodge the traffic. How far can you drive? A free little arcade game, no ads.",
    category: "arcade",
  },
});
