import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "hoop-city",
  title: "Hoop City",
  tagline: "Float the ball through hoops over the city.",
  description:
    "Tap to keep the ball afloat while threading every vertical hoop as the city scrolls by.",
  objective: "Float the ball through each hoop without touching the skyline or missing a ring.",
  controls: "Tap anywhere or press space to bounce upward.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 2.15 },
  cover: "/assets/hoop-city/hoopcity.jpg",
  createdAt: "2025-11-28T00:00:00.000Z",
  updatedAt: "2025-12-02T00:00:00.000Z",
  seo: {
    description:
      "Tap to float the ball through hoops as the city scrolls past. Free, no ads, one more go guaranteed.",
    category: "arcade",
  },
});
