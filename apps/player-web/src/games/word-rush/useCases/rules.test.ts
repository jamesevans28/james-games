import { test, expect } from "vitest";
import {
  BOARD,
  BUY_COST_MS,
  MAX_INPUT,
  boardLines,
  canBuyLetter,
  fitsBoard,
  hiddenLetters,
  isCorrect,
  lengthBand,
  lettersOnly,
  phrasesFor,
  pickLetterToBuy,
  pickPhrase,
  revealLetters,
  scoreFor,
  timeFor,
  typeKey,
} from "./rules";
import { categories } from "../data";
import { mulberry32 } from "../../../platform/rng";

test("revealLetters shows chosen letters, spaces and punctuation", () => {
  expect(revealLetters("RED PANDA", ["A", "R"])).toBe("R__ _A__A");
  expect(revealLetters("BIRD'S NEST", [])).toBe("____'_ ____");
  expect(revealLetters("YO-YO", "OY")).toBe("YO-YO");
  expect(revealLetters("LION", [])).toBe("____");
});

test("hiddenLetters lists each hidden letter once", () => {
  expect(hiddenLetters("BANANA", ["A"])).toEqual(["B", "N"]);
  expect(hiddenLetters("YO-YO", ["Y", "O"])).toEqual([]);
});

test("answers ignore case, spaces and punctuation", () => {
  expect(lettersOnly("Bird's nest")).toBe("BIRDSNEST");
  expect(isCorrect("toy story", "TOY STORY")).toBe(true);
  expect(isCorrect("TOYSTORY ", "TOY STORY")).toBe(true);
  expect(isCorrect("BIRDS NEST", "BIRD'S NEST")).toBe(true);
  expect(isCorrect("YOYO", "YO-YO")).toBe(true);
  expect(isCorrect("TOY STOREY", "TOY STORY")).toBe(false);
  expect(isCorrect("", "")).toBe(false);
});

test("timeFor is two minutes early on, then gently shorter to 90 s", () => {
  expect(timeFor(1)).toBe(120_000);
  expect(timeFor(3)).toBe(120_000);
  expect(timeFor(4)).toBe(115_000);
  expect(timeFor(9)).toBe(90_000);
  expect(timeFor(50)).toBe(90_000);
  for (let level = 1; level < 30; level++) {
    expect(timeFor(level + 1)).toBeLessThanOrEqual(timeFor(level));
  }
});

test("levels 1–3 use short phrases, 4+ longer ones", () => {
  expect(lengthBand(1)).toEqual({ min: 1, max: 7 });
  expect(lengthBand(4).min).toBe(7);
  const sample = ["UP", "LION", "GUINEA PIG", "TASMANIAN DEVIL", "BIRD'S NEST"];
  expect(phrasesFor(2, sample)).toEqual(["UP", "LION"]);
  expect(phrasesFor(4, sample)).toEqual(["GUINEA PIG", "TASMANIAN DEVIL", "BIRD'S NEST"]);
});

test("boardLines wraps words onto lines", () => {
  expect(boardLines("BEAUTY AND THE BEAST")).toEqual([
    ["BEAUTY", "AND"],
    ["THE", "BEAST"],
  ]);
  expect(boardLines("LION")).toEqual([["LION"]]);
  expect(boardLines("A B C", 3)).toEqual([["A", "B"], ["C"]]);
});

test("fitsBoard rejects what the board can't show", () => {
  expect(fitsBoard("BIRD'S NEST")).toBe(true);
  expect(fitsBoard("lion")).toBe(false);
  expect(fitsBoard("LION!")).toBe(false);
  expect(fitsBoard("RED  PANDA")).toBe(false);
  expect(fitsBoard(" LION")).toBe(false);
  expect(fitsBoard("-LION")).toBe(false);
  expect(fitsBoard("SUPERCALIFRAGILISTIC")).toBe(false);
  expect(fitsBoard("ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT")).toBe(false);
});

test("every phrase uses only A–Z, spaces and punctuation the board can show", () => {
  for (const c of categories) {
    for (const phrase of c.phrases) {
      expect(fitsBoard(phrase), `${c.name}: ${phrase}`).toBe(true);
      expect(phrase.length).toBeLessThanOrEqual(MAX_INPUT);
      const lines = boardLines(phrase);
      expect(lines.length).toBeLessThanOrEqual(BOARD.maxLines);
    }
  }
});

test("ten kid-safe categories of 30–60 phrases, enough for every level", () => {
  expect(categories.map((c) => c.name)).toEqual([
    "Animals",
    "Food",
    "Colours",
    "School Things",
    "Places",
    "Sports",
    "Kids' Films",
    "Nature",
    "Jobs",
    "Things in a House",
  ]);
  for (const c of categories) {
    expect(c.phrases.length, c.name).toBeGreaterThanOrEqual(30);
    expect(c.phrases.length, c.name).toBeLessThanOrEqual(60);
    expect(new Set(c.phrases).size, `${c.name} has duplicates`).toBe(c.phrases.length);
    expect(phrasesFor(1, c.phrases).length, c.name).toBeGreaterThanOrEqual(15);
    expect(phrasesFor(4, c.phrases).length, c.name).toBeGreaterThanOrEqual(15);
    expect(
      c.phrases.some((p) => p.includes(" ")),
      `${c.name} has phrases`,
    ).toBe(true);
  }
});

test("pickPhrase suits the level, avoids repeats and replays by seed", () => {
  const rng = mulberry32(7);
  const used = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const pick = pickPhrase(2, categories, rng, used);
    expect(pick).not.toBeNull();
    if (!pick) return;
    expect(lettersOnly(pick.phrase).length).toBeLessThanOrEqual(7);
    expect(used.has(pick.phrase)).toBe(false);
    used.add(pick.phrase);
  }
  const run = (seed: number) => {
    const r = mulberry32(seed);
    return Array.from({ length: 5 }, (_, i) => pickPhrase(i + 1, categories, r)?.phrase);
  };
  expect(run(3)).toEqual(run(3));
});

test("pickPhrase repeats only once a band is used up", () => {
  const tiny = [{ name: "Tiny", phrases: ["CAT", "DOG"] }];
  const pick = pickPhrase(1, tiny, () => 0, new Set(["CAT", "DOG"]));
  expect(pick).toEqual({ category: "Tiny", phrase: "CAT" });
  expect(pickPhrase(1, tiny, () => 0.99, new Set(["CAT"]))?.phrase).toBe("DOG");
  expect(pickPhrase(5, tiny, () => 0)).toBeNull();
});

test("buying a letter needs a hidden letter and enough time", () => {
  expect(canBuyLetter(120_000, "LION", [])).toBe(true);
  expect(canBuyLetter(BUY_COST_MS + 4_999, "LION", [])).toBe(false);
  expect(canBuyLetter(BUY_COST_MS + 5_000, "LION", [])).toBe(true);
  expect(canBuyLetter(120_000, "LION", "LION")).toBe(false);
  expect(pickLetterToBuy("LION", "LIO", Math.random)).toBe("N");
  expect(pickLetterToBuy("LION", "LION", Math.random)).toBeNull();
  const letter = pickLetterToBuy("BANANA", [], mulberry32(1));
  expect(["B", "A", "N"]).toContain(letter);
});

test("scoring is the seconds left on the clock", () => {
  expect(scoreFor(120_000)).toBe(120);
  expect(scoreFor(42_300)).toBe(43);
  expect(scoreFor(1)).toBe(1);
  expect(scoreFor(0)).toBe(0);
  expect(scoreFor(-500)).toBe(0);
});

test("typing keys builds the answer", () => {
  expect(typeKey("", "SPACE")).toBe("");
  expect(typeKey("RED", "SPACE")).toBe("RED ");
  expect(typeKey("RED ", "SPACE")).toBe("RED ");
  expect(typeKey("RED ", "P")).toBe("RED P");
  expect(typeKey("RED", "BACKSPACE")).toBe("RE");
  expect(typeKey("", "BACKSPACE")).toBe("");
  expect(typeKey("RED", "?")).toBe("RED");
  const full = "A".repeat(MAX_INPUT);
  expect(typeKey(full, "B")).toBe(full);
  expect(typeKey(full, "BACKSPACE")).toHaveLength(MAX_INPUT - 1);
});
