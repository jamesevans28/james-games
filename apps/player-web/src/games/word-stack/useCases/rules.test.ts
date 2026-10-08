import { test, expect } from "vitest";
import { mulberry32 } from "../../../platform/rng";
import { isValidEnglishFiveLetterWord } from "../../../game/words/dictionary";
import {
  availableSteps,
  CONSONANTS,
  dealOffers,
  dealPlayableOffers,
  isHighValueLetter,
  isValidStep,
  judgeStep,
  pickStartWord,
  replaceAt,
  replaceOffer,
  START_WORDS,
  stepScore,
  VOWELS,
  type Offer,
} from "./rules";
import { dailySeed } from "./dailySeed";

const tiny = new Set(["CRANE", "CRATE", "GRATE", "CRONE", "TRACE"]);
const isTiny = (w: string) => tiny.has(w);

test("replaceAt swaps one letter", () => {
  expect(replaceAt("CRANE", 0, "B")).toBe("BRANE");
  expect(replaceAt("CRANE", 4, "Y")).toBe("CRANY");
});

test("a valid step changes exactly one letter and makes a word", () => {
  expect(isValidStep("CRANE", "CRATE", isTiny)).toBe(true);
  expect(isValidStep("CRANE", "CRANE", isTiny)).toBe(false); // nothing changed
  expect(isValidStep("CRANE", "GRATE", isTiny)).toBe(false); // two letters changed
  expect(isValidStep("CRANE", "TRACE", isTiny)).toBe(false); // rearranged
  expect(isValidStep("CRANE", "CRAXE", isTiny)).toBe(false); // not a word
  expect(isValidStep("CRANE", "CRAT", isTiny)).toBe(false); // wrong length
});

test("isValidStep uses the real dictionary by default", () => {
  expect(isValidStep("STONE", "STORE")).toBe(true);
  expect(isValidStep("STONE", "STQNE")).toBe(false);
});

test("judgeStep says why a step was refused", () => {
  const used = new Set(["CRANE", "CRONE"]);
  expect(judgeStep("CRANE", "CRANE", used, isTiny)).toBe("same");
  expect(judgeStep("CRANE", "CRONE", used, isTiny)).toBe("used");
  expect(judgeStep("CRANE", "CRAXE", used, isTiny)).toBe("not-a-word");
  expect(judgeStep("CRANE", "CRATE", used, isTiny)).toBe("ok");
});

test("a step scores its Scrabble letter values", () => {
  expect(stepScore("CRANE")).toBe(7);
  expect(stepScore("JAZZY")).toBe(33);
  expect(stepScore("crane")).toBe(7);
});

test("availableSteps lists each new word once", () => {
  const used = new Set(["CRANE"]);
  expect(availableSteps("CRANE", ["T", "O", "Z"], used, isTiny).sort()).toEqual(["CRATE", "CRONE"]);
  expect(availableSteps("CRANE", ["T", "T"], new Set(["CRANE", "CRATE"]), isTiny)).toEqual([]);
});

test("every start word is a real word with somewhere to go", () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  for (const word of START_WORDS) {
    expect(isValidEnglishFiveLetterWord(word)).toBe(true);
    expect(availableSteps(word, letters, new Set([word])).length).toBeGreaterThanOrEqual(10);
  }
});

test("the start word is the same for everyone on the same day", () => {
  const today = dailySeed(new Date(2026, 9, 9));
  const a = pickStartWord(mulberry32(today));
  const b = pickStartWord(mulberry32(today));
  expect(a).toBe(b);
  expect(START_WORDS).toContain(a);
  const week = Array.from({ length: 7 }, (_, d) =>
    pickStartWord(mulberry32(dailySeed(new Date(2026, 9, 9 + d)))),
  );
  expect(new Set(week).size).toBeGreaterThan(1);
});

test("pickStartWord covers its list and refuses an empty one", () => {
  expect(pickStartWord(() => 0)).toBe(START_WORDS[0]);
  expect(pickStartWord(() => 0.9999)).toBe(START_WORDS[START_WORDS.length - 1]);
  expect(() => pickStartWord(() => 0, [])).toThrow();
});

function checkDeal(offers: Offer[]) {
  expect(offers.filter((o) => o.kind === "vowel")).toHaveLength(2);
  expect(offers.filter((o) => o.kind === "consonant")).toHaveLength(5);
  expect(new Set(offers.map((o) => o.letter)).size).toBe(offers.length);
  expect(offers.filter((o) => isHighValueLetter(o.letter)).length).toBeLessThanOrEqual(1);
  for (const o of offers) {
    const pool: readonly string[] = o.kind === "vowel" ? VOWELS : CONSONANTS;
    expect(pool).toContain(o.letter);
  }
}

test("a deal is 2 vowels + 5 consonants, all different, at most one of QZJX", () => {
  const rng = mulberry32(1);
  for (let i = 0; i < 200; i++) checkDeal(dealOffers(rng));
});

test("deals repeat for the same seed", () => {
  expect(dealOffers(mulberry32(42))).toEqual(dealOffers(mulberry32(42)));
});

test("replacing a used offer keeps the deal's rules", () => {
  const rng = mulberry32(7);
  let offers = dealOffers(rng);
  for (let i = 0; i < 300; i++) {
    const index = i % offers.length;
    const before = offers[index];
    offers = replaceOffer(offers, index, rng);
    expect(offers[index]?.kind).toBe(before?.kind);
    checkDeal(offers);
  }
  expect(replaceOffer(offers, 99, rng)).toEqual(offers);
});

test("a run never opens on a dead end", () => {
  const rng = mulberry32(3);
  for (const word of START_WORDS) {
    const offers = dealPlayableOffers(rng, word, new Set([word]));
    const letters = offers.map((o) => o.letter);
    expect(availableSteps(word, letters, new Set([word])).length).toBeGreaterThan(0);
  }
});

test("dealPlayableOffers gives up after its tries", () => {
  const offers = dealPlayableOffers(mulberry32(5), "CRANE", new Set(), () => false, 3);
  checkDeal(offers);
});

test("isHighValueLetter is Q, Z, J and X", () => {
  const high = [...CONSONANTS, ...VOWELS].filter(isHighValueLetter).sort();
  expect(high).toEqual(["J", "Q", "X", "Z"]);
});
