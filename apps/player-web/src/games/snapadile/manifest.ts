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
});
