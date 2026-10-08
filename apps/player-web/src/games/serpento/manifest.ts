import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "serpento",
  title: "Serpento",
  tagline: "Eat, grow, and don't bite your own tail.",
  description:
    "Classic snake game. Steer to the apples, avoid the walls and yourself. Gets faster as you grow!",
  objective: "Eat apples to grow longer and score; don't hit the walls or your own tail.",
  controls:
    "Swipe up, down, left or right to steer, or tap the arrow pad under the board. Arrow keys or WASD on a keyboard.",
  makers: [...brand.makers],
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["swipe", "dpad", "keyboard"],
  // 1 point per apple. The board is 17 × 20 = 340 cells and the snake starts 3 long,
  // so no run can score more than 337. At most one apple per move, and moves are never
  // quicker than 80 ms, so 12.5 points/s is a hard ceiling (real play is ~1/s).
  scoring: { max: 340, perSecondMax: 13, xpMultiplier: 18.5 },
  cover: "/assets/serpento/thumbnail.svg",
  createdAt: "2025-11-17T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
  seo: {
    description:
      "Eat to grow, don't hit the walls (or yourself). Our take on the classic snake game. Free, no ads.",
    category: "arcade",
  },
});
