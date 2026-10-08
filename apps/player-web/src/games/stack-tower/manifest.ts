import { defineGame } from "../../platform/sdk";

export default defineGame({
  id: "stack-tower",
  title: "Stack Tower",
  tagline: "Drop each block on the tower. How high can you go?",
  description:
    "A block slides back and forth above your tower. Tap to drop it. Any bit that hangs over the edge gets chopped off, so the next block is smaller.",
  objective: "Build the tallest tower you can.",
  controls: "Tap anywhere to drop the block.",
  makers: ["Harvey"],
  status: "beta",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  scoring: { max: 10_000, perSecondMax: 5, xpMultiplier: 1 },
  cover: "/assets/stack-tower/cover.svg",
  createdAt: "2026-10-08T00:00:00.000Z",
  updatedAt: "2026-10-08T00:00:00.000Z",
  seo: {
    description: "Drop each block on the tower and see how high you can stack. Free, no ads.",
    category: "casual",
  },
});
