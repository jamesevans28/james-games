import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "reflex-ring",
  title: "Reflex Ring",
  tagline: "Tap when the arrow hits the bright segment.",
  description: "Tap precisely as the arrow hits the highlighted segment. Speeds up over time.",
  objective: "Tap the screen exactly when the rotating arrow overlaps with the colored segment.",
  controls:
    "Tap anywhere when the arrow is over the coloured wedge. Collect power-ups with the arrow tip.",
  makers: [...brand.makers],
  // TODO note: James to replace with the real one (draft by Claude).
  note: "Tap right when the arrow lands on the bright bit. It gets faster and faster, so get ready!",
  noteBy: "Tilly",
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  // 1 point a hit, 2 for a perfect one. Fastest possible: top speed 5 rad/s and
  // targets at least 40° apart → about 7 hits/s, so 14 points/s is the ceiling
  // (auto-tap power-up included). A great run is a few hundred; max leaves room.
  scoring: { max: 5_000, perSecondMax: 15, xpMultiplier: 2.92 },
  cover: "/assets/reflex-ring/thumbnail.svg",
  createdAt: "2025-09-15T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
  seo: {
    description:
      "Tap when the arrow hits the bright segment. It speeds up every round. Free, no ads.",
    category: "reflex",
  },
});
