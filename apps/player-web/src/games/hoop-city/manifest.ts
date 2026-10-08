import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "hoop-city",
  title: "Hoop City",
  tagline: "Float the ball through hoops over the city.",
  description:
    "Tap to keep the ball afloat and drop it through every hoop as the city scrolls by. Swish through the middle for a Perfect and keep your combo going.",
  objective:
    "Get the ball through every hoop. Missing a hoop or letting the ball fall off the bottom ends the run. Clean passes build a combo; touching the rim resets it.",
  controls: "Tap anywhere (or press Space or Enter) to bounce the ball up.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  // A pass scores the combo (capped at 10), doubled for a perfect: at most 20 a hoop.
  // Hoops are at least ~540 px apart at 140 px/s, so one every ~3.9 s at best:
  // ≤ 5.2 points/s, ×2 margin → 10. A great five-minute run is about 1,200; max is
  // over an hour of flawless play.
  scoring: { max: 20_000, perSecondMax: 10, xpMultiplier: 2.15 },
  cover: "/assets/hoop-city/hoopcity.jpg",
  createdAt: "2025-11-28T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
  seo: {
    description:
      "Tap to float the ball through hoops as the city scrolls past. Free, no ads, one more go guaranteed.",
    category: "arcade",
  },
});
