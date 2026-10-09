import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "cosmic-clash",
  title: "Cosmic Clash",
  tagline: "Blast the space invaders and survive the waves.",
  description:
    "Space Invaders-style shooter. Auto-fire at descending aliens, collect power-ups, survive waves!",
  objective:
    "Shoot down each wave of aliens before they land on your planet, and dodge their shots. Grab power-ups for double shots, rapid fire and a shield.",
  controls:
    "Hold left or right to move; tap a side to nudge. Your ship fires by itself. On a keyboard, use the arrow keys or A and D.",
  makers: [...brand.makers],
  // TODO note: James to replace with the real one (draft by Claude).
  note: "I love space. The aliens come faster and faster, so keep moving and keep blasting!",
  noteBy: "Harvey",
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["hold", "tap", "keyboard"],
  // 10 points an alien, one hit per bullet. Fastest possible: rapid + double fire
  // is 2 bullets every 275 ms ≈ 7.3 hits/s ≈ 73 points/s, so 150/s is ~2× the
  // ceiling. A wave is 32 aliens = 320 points and takes 10 s+ to clear; a great
  // run is 20–30 waves (6,000–10,000). 100,000 is ~300 waves.
  scoring: { max: 100_000, perSecondMax: 150, xpMultiplier: 0.5 },
  cover: "/assets/cosmic-clash/thumbnail.svg",
  createdAt: "2025-11-21T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
  seo: {
    description:
      "Blast the space invaders, grab power-ups and survive the waves. Free shooter, no ads.",
    category: "action",
  },
});
