import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "paddle-pop",
  title: "Paddle Pop",
  tagline: "Bounce the ball, smash the targets, grab power-ups.",
  description: "Deflect the marble, collect power-ups, hit bonus discs, avoid falling obstacles.",
  objective:
    "Keep the balls bouncing off your paddle and bump the numbered discs for points. Don't let a fireball touch your paddle.",
  controls:
    "Hold the left or right side of the screen to slide the paddle (arrow keys or A/D on a keyboard). Hit power-ups with the ball to collect them.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["hold"],
  // +1 a paddle bounce: at most 9 balls, each needing ~1.6 s for the 1,400 px round
  // trip at the 850 px/s cap, so under 6 points/s. Discs are worth 1–10 and score
  // at most once per 400 ms; at most ~1.7 are alive on average (≤2 every 6 s, 5 s
  // each), so a ball pinned against a disc gives at most ~42 points/s. That ~48/s
  // ceiling is never sustained; real play is 2–5 points/s. A great run (4–5 min) is
  // around 1,500; max leaves lots of room.
  scoring: { max: 20_000, perSecondMax: 50, xpMultiplier: 5.13 },
  cover: "/assets/paddle-pop/paddlepop.jpg",
  createdAt: "2025-11-05T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
  seo: {
    description:
      "Bounce the ball, hit the targets, grab the power-ups. A free paddle game, no ads.",
    category: "arcade",
  },
});
