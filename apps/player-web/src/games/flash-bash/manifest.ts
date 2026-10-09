import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "flash-bash",
  title: "Flash Bash",
  tagline: "Watch the lights, then copy the pattern.",
  description:
    "Watch the sequence of colored shapes, then mimic them before time runs out. Sequences get longer!",
  objective:
    "Copy each pattern of flashing shapes. Patterns get longer, and every three patterns the shapes swap buttons.",
  controls:
    "Watch the shapes flash in the middle, then tap the buttons with the same shapes in the same order before the bar runs out. Keys 1 to 6 work on a keyboard.",
  makers: [...brand.makers],
  // TODO note: James to replace with the real one (draft by Claude).
  note: "Watch really carefully and say the pattern in your head. That's how I remember it.",
  noteBy: "Tilly",
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  // 1 point a correct press, +3 a finished pattern. A pattern of L flashes takes at
  // least 0.3 s lead + L × 0.57 s playback (fastest flash + gap) + 1.1 s bonus pause,
  // so (L + 3) / (1.4 + 0.57 L) ≤ ~2.1 points/s even with instant taps; 5 is ~2×.
  // A great run (8 rounds, 24 patterns) scores about 200; max leaves lots of room.
  scoring: { max: 5_000, perSecondMax: 5, xpMultiplier: 4.13 },
  cover: "/assets/flash-bash/thumbnail.svg",
  createdAt: "2025-11-04T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
  seo: {
    description:
      "Watch the lights, then copy the pattern. How long a sequence can you remember? Free memory game, no ads.",
    category: "memory",
  },
});
