import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "blocker",
  title: "Blocker",
  tagline: "Drop blocks, clear lines, chain combos.",
  description:
    "Drag puzzle pieces onto an 8×8 board, clear full lines, trigger power blocks, and chase combos before you run out of moves.",
  objective:
    "Fill whole rows or columns to clear them. Every block you place scores a point, and clearing two or more lines at once leaves a power block. The game ends when none of your three pieces fit.",
  controls:
    "Drag a piece from the tray at the bottom onto the board. Tap the round button to turn all three pieces.",
  makers: [...brand.makers],
  // TODO note: James to replace with the real one (draft by Claude).
  note: "Fitting the blocks in is my favourite bit. When you clear two lines at once it feels SO good.",
  noteBy: "Harvey",
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["drag", "tap"],
  // +1 a cell placed, plus 10 a cleared cell × up to 2.5 for a combo. Every cleared
  // cell was placed first, so a run scores at most ~26 a placed cell. A move is at
  // most 5 cells and takes ≥ 0.6 s even for a very fast player: ≤ ~8 cells/s, so
  // ≤ ~220 points/s → 250. A great run (a few hundred moves, ~50 points a move) is
  // ~25k, but there is no time limit, so max leaves plenty of room.
  scoring: { max: 500_000, perSecondMax: 250, xpMultiplier: 0.63 },
  cover: "/assets/blocker/thumbnail.svg",
  createdAt: "2025-11-24T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
  seo: {
    description:
      "Drop blocks, clear lines, chain combos. Easy to start, hard to stop. Free puzzle game, no ads.",
    category: "puzzle",
  },
  // Remix mode (T11.2). The default is the normal game.
  remix: [{ key: "traySize", label: "Pieces to pick from", min: 1, max: 4, step: 1, default: 3 }],
});
