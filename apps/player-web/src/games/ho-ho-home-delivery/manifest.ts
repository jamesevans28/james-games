import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "ho-ho-home-delivery",
  title: "Ho Ho Home Delivery",
  tagline: "Help Santa drop presents down the chimneys.",
  description:
    "Drop presents into chimneys from Santa's sleigh. Nail the landing, avoid misses. 3 lives!",
  objective: "Deliver presents into the chimneys as you fly over houses.",
  controls: "Tap to drop a present.",
  makers: [...brand.makers],
  status: "inactive",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 3.78 },
  cover: "/assets/ho-ho-home-delivery/thumbnail.svg",
  createdAt: "2025-11-05T00:00:00.000Z",
  updatedAt: "2025-11-25T00:00:00.000Z",
  seo: {
    description: "Help Santa drop presents down the chimneys. A free Christmas game, no ads.",
    category: "arcade",
  },
});
