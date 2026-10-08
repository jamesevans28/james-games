import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "box-cutter",
  title: "Box Cutter",
  tagline: "Draw lines to box off the board. Dodge the fireball!",
  description: "Draw lines to capture territory while avoiding the bouncing enemy ball.",
  objective:
    "Box off enough of the board to clear each level (75% to start) without the fireball touching your line. You have 3 lives.",
  controls:
    "Use the on-screen arrow pad (or swipe, or the arrow keys) to move along the edge and draw a line across the board. Grab the clock to slow the fireball for 5 seconds. Tap Next level when a level is done.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["dpad", "swipe"],
  // A capture of p% scores floor(10p(1 + 0.015p)); that grows faster than p, so the
  // captures in one level (≤ 100% of the board) sum to at most 2,500. At 200 px/s a
  // level takes at least ~4 s to clear plus the Next level tap → ~600 points/s
  // ceiling; perSecondMax leaves margin. A great run is ~10 levels (~15,000).
  scoring: { max: 100_000, perSecondMax: 1_000, xpMultiplier: 0.03 },
  cover: "/assets/box-cutter/boxcutter.jpg",
  createdAt: "2025-12-23T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
  seo: {
    description:
      "Draw lines to box off the board while dodging the fireball. Free, no ads, very satisfying.",
    category: "arcade",
  },
});
