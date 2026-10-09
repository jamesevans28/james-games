import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "snapadile",
  title: "Snapadile",
  tagline: "Tap the crocs before they snap your raft.",
  description: "Tap the crocs before they reach your raft. More and faster crocs over time.",
  objective: "Prevent crocodiles from reaching your raft by tapping them.",
  controls: "Tap on the crocodiles to scare them away.",
  makers: [...brand.makers],
  // TODO note: James to replace with the real one (draft by Claude).
  note: "The crocs aren't mean, they just want a ride on the raft! Tap them fast so they swim away.",
  noteBy: "Tilly",
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  // 1 point a croc; even six crocs at once can't be tapped faster than this.
  scoring: { max: 10_000, perSecondMax: 15, xpMultiplier: 1.93 },
  cover: "/assets/snapadile/snapadile.jpg",
  createdAt: "2025-09-16T00:00:00.000Z",
  updatedAt: "2025-11-25T00:00:00.000Z",
  seo: {
    description:
      "Crocs are swimming for your raft! Tap them before they snap. Free, no ads, and great for small fingers.",
    category: "reflex",
  },
  // Remix mode (T11.2). The defaults are the normal game.
  remix: [
    { key: "speed", label: "Croc speed", min: 0.5, max: 2.5, step: 0.25, default: 1 },
    { key: "lives", label: "Lives", min: 1, max: 5, step: 1, default: 3 },
    { key: "crocSize", label: "Croc size", min: 0.6, max: 1.4, step: 0.1, default: 1 },
  ],
});
