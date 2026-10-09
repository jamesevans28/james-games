import { defineGame } from "../../platform/sdk";
import { brand } from "../../config/brand";

export default defineGame({
  id: "word-stack",
  title: "Word Stack",
  tagline: "Swap one letter at a time to build a stack of words.",
  description:
    "Everyone starts the day on the same 5-letter word. Swap one letter at a time to make new words and build the tallest stack you can.",
  objective:
    "Make as many new 5-letter words as you can. Each word scores its letter values. The run ends when no offered letter makes a new word, or when you press Finish.",
  controls:
    "Drag a green or blue letter tile onto a letter of the word to swap it. Press Finish when you want to stop.",
  makers: [...brand.makers],
  // TODO note: James to replace with the real one (draft by Claude).
  note: "Change one letter at a time, like CAT to COT to DOT. It's like climbing a word ladder!",
  noteBy: "Tilly",
  status: "active",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["drag"],
  // A word scores its Scrabble letter values: about 9 on average, 34 at most (PZAZZ),
  // and only one of Q/Z/J/X is ever on offer. A drag takes about a second, so a very
  // fast player makes ~12 points a second; 30 covers that with margin, including a
  // short run that ends on one big word. Runs have no turn cap: a great run is ~60
  // words (~600 points), so 20,000 (about 2,000 words) is far above any real stack.
  scoring: { max: 20_000, perSecondMax: 30, xpMultiplier: 1.0 },
  cover: "/assets/word-stack/thumbnail.svg",
  createdAt: "2025-12-26T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
  seo: {
    description:
      "Start with one 5-letter word, then swap in letters to make new ones. Free word puzzle, no ads.",
    category: "word",
  },
});
