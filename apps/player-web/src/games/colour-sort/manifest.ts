import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "colour-sort",
  title: "Colour Sort",
  tagline: "Pour the balls between tubes until every tube is one colour.",
  description:
    "Each tube holds four balls. Pick up the top balls of a tube and pour them onto the same colour or into an empty tube. Sort every tube to clear the level. Each colour has its own pattern too, so you can play by shape.",
  objective: "Sort every tube to a single colour, in as few moves as you can. 20 levels.",
  controls:
    "Tap a tube to pick up its top balls, then tap another tube to pour them in. Tap the same tube to put them back. Keys 1 to 9 pick tubes on a keyboard. Stuck? Tap Give up to end the run.",
  makers: [...brand.makers], // James, Tilly and Harvey
  // TODO note: James to replace with the real one (draft by Claude).
  note: "Look at the top balls first and keep one tube empty for as long as you can!",
  noteBy: "Tilly",
  status: "beta",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  // 100 a cleared level + up to 50 for finishing within par (the moves the generator
  // used to mix it), and the run ends after level 20: 20 × 150 = 3,000 is a hard cap.
  // Every level needs at least 2 pours (4 taps) and there is a 1.2 s pause after each
  // clear, so even ~0.15 s taps give ≤ 150 / 1.8 s ≈ 83 points/s; real play is under
  // 20. perSecondMax 150 is ~2× the superhuman ceiling. A great run (all 20 levels,
  // mostly within par) is ~2,600, so 0.5 XP a point gives ~1,300 XP for a long run.
  scoring: { max: 3_000, perSecondMax: 150, xpMultiplier: 0.5 },
  cover: "/assets/colour-sort/cover.svg",
  createdAt: "2026-10-09T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
  seo: {
    description:
      "Pour the balls between tubes until each one is a single colour. Patterns on every ball, so it works by shape too. Free, no ads.",
    category: "puzzle",
  },
  // Remix mode (T11.2). The defaults are the normal game. Fewer colours or more empty
  // tubes only make levels easier; they still need ≥ 2 pours, so the limits hold.
  remix: [
    { key: "colours", label: "Most colours", min: 2, max: 6, step: 1, default: 6 },
    { key: "spare", label: "Empty tubes", min: 1, max: 3, step: 1, default: 2 },
  ],
});
