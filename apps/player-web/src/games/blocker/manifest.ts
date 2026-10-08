import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "blocker",
  title: "Blocker",
  tagline: "Drop blocks, clear lines, chain combos.",
  description:
    "Drag puzzle pieces into a 8x8 board, clear full lines, trigger power blocks, and chase combos before you run out of moves.",
  objective: "Place blocks to form full rows or columns to clear them.",
  controls: "Drag and drop blocks onto the grid.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["drag", "tap"],
  // Backend defaults until per-game limits are tuned (T6.6).
  scoring: { max: 1_000_000, perSecondMax: 2_000, xpMultiplier: 0.63 },
  cover: "/assets/blocker/thumbnail.svg",
  createdAt: "2025-11-24T00:00:00.000Z",
  updatedAt: "2025-11-25T00:00:00.000Z",
  seo: {
    description:
      "Drop blocks, clear lines, chain combos. Easy to start, hard to stop. Free puzzle game, no ads.",
    category: "puzzle",
  },
});
