/**
 * Word Stack rules: no Phaser here. A step swaps exactly one letter of the current
 * word for one of the offered letters and must make a new dictionary word.
 */
import { isValidEnglishFiveLetterWord } from "../../../game/words/dictionary";
import { SCRABBLE_LETTER_SCORES, scoreScrabbleWord } from "../../../game/words/scrabble";

export type IsWord = (word: string) => boolean;
export type Rng = () => number;

export const WORD_LENGTH = 5;

export const VOWELS = ["A", "E", "I", "O", "U"] as const;
export const CONSONANTS = [
  "B",
  "C",
  "D",
  "F",
  "G",
  "H",
  "J",
  "K",
  "L",
  "M",
  "N",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "V",
  "W",
  "X",
  "Y",
  "Z",
] as const;

/** How many of each kind are on offer at once. */
export const OFFER_VOWELS = 2;
export const OFFER_CONSONANTS = 5;

/**
 * Common, friendly start words. Each is in the dictionary and has at least ten
 * one-letter neighbours, so the opening is never a dead end.
 */
export const START_WORDS = [
  "TALES",
  "LINES",
  "PINES",
  "GAMES",
  "STARE",
  "BOOTS",
  "RIVER",
  "CARDS",
  "BEARS",
  "TILES",
  "BIKES",
  "LIMES",
  "MINTS",
  "SPARE",
  "STORE",
  "WINGS",
  "WATER",
  "SHORE",
  "BOATS",
  "TOWER",
  "HIKES",
  "STONE",
  "LIGHT",
  "POWER",
  "SPELL",
  "GRAPE",
  "SHINE",
  "BRAVE",
  "HORSE",
  "MOUSE",
  "CANDY",
  "GRASS",
  "SHORT",
  "CRANE",
  "SHARK",
  "HATCH",
  "SHELL",
  "SHIRT",
  "PARTY",
  "FUNNY",
  "HOUSE",
  "MATCH",
  "PATCH",
  "SHADE",
  "SPORT",
  "BEACH",
  "CLOCK",
  "CATCH",
  "STICK",
  "TRICK",
  "SHAPE",
  "THING",
  "HAPPY",
] as const;

function pick<T>(items: readonly T[], rng: Rng): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error("pick from an empty list");
  return item;
}

/** The day's start word: pass `host.rng(dailySeed(date))`. */
export function pickStartWord(rng: Rng, words: readonly string[] = START_WORDS): string {
  return pick(words, rng);
}

export function replaceAt(word: string, index: number, letter: string): string {
  return word.slice(0, index) + letter + word.slice(index + 1);
}

/** True when `b` is a dictionary word made from `a` by changing exactly one letter. */
export function isValidStep(
  a: string,
  b: string,
  isWord: IsWord = isValidEnglishFiveLetterWord,
): boolean {
  if (a.length !== WORD_LENGTH || b.length !== WORD_LENGTH) return false;
  let changed = 0;
  for (let i = 0; i < WORD_LENGTH; i++) if (a[i] !== b[i]) changed += 1;
  return changed === 1 && isWord(b);
}

export type StepVerdict = "ok" | "same" | "used" | "not-a-word";

/** Why a drop was accepted or refused, for the status line. */
export function judgeStep(
  current: string,
  candidate: string,
  used: ReadonlySet<string>,
  isWord: IsWord = isValidEnglishFiveLetterWord,
): StepVerdict {
  if (candidate === current) return "same";
  if (used.has(candidate)) return "used";
  return isValidStep(current, candidate, isWord) ? "ok" : "not-a-word";
}

/** Points for making `word`: its Scrabble letter values added up. */
export function stepScore(word: string): number {
  return scoreScrabbleWord(word);
}

/** Every new word one offered letter away from `word`, without repeats. */
export function availableSteps(
  word: string,
  letters: readonly string[],
  used: ReadonlySet<string>,
  isWord: IsWord = isValidEnglishFiveLetterWord,
): string[] {
  const found = new Set<string>();
  for (let i = 0; i < word.length; i++) {
    for (const letter of letters) {
      const candidate = replaceAt(word, i, letter);
      if (found.has(candidate)) continue;
      if (judgeStep(word, candidate, used, isWord) === "ok") found.add(candidate);
    }
  }
  return [...found];
}

export type OfferKind = "vowel" | "consonant";
export type Offer = { kind: OfferKind; letter: string };

/** Q, Z, J and X: only one of these on offer at a time. */
export function isHighValueLetter(letter: string): boolean {
  return (SCRABBLE_LETTER_SCORES[letter] ?? 0) > 7;
}

/** A letter of `kind` not already on offer, with at most one high-value letter showing. */
function drawLetter(kind: OfferKind, others: readonly Offer[], rng: Rng): string {
  const pool: readonly string[] = kind === "vowel" ? VOWELS : CONSONANTS;
  const taken = new Set(others.map((o) => o.letter));
  const hasHighValue = others.some((o) => isHighValueLetter(o.letter));
  const fresh = pool.filter((l) => !taken.has(l));
  const allowed = fresh.filter((l) => !(hasHighValue && isHighValueLetter(l)));
  return pick(allowed.length > 0 ? allowed : fresh.length > 0 ? fresh : pool, rng);
}

/** Two vowels and five consonants, all different, at most one of Q/Z/J/X. */
export function dealOffers(rng: Rng): Offer[] {
  const offers: Offer[] = [];
  for (let i = 0; i < OFFER_VOWELS; i++) {
    offers.push({ kind: "vowel", letter: drawLetter("vowel", offers, rng) });
  }
  for (let i = 0; i < OFFER_CONSONANTS; i++) {
    offers.push({ kind: "consonant", letter: drawLetter("consonant", offers, rng) });
  }
  return offers;
}

/**
 * Deals until at least one step is possible from `word` (up to `tries` deals), so
 * a run never opens on a dead end. Falls back to the last deal.
 */
export function dealPlayableOffers(
  rng: Rng,
  word: string,
  used: ReadonlySet<string>,
  isWord: IsWord = isValidEnglishFiveLetterWord,
  tries = 20,
): Offer[] {
  let offers = dealOffers(rng);
  for (let i = 1; i < tries; i++) {
    const letters = offers.map((o) => o.letter);
    if (availableSteps(word, letters, used, isWord).length > 0) break;
    offers = dealOffers(rng);
  }
  return offers;
}

/** The offer at `index` was used: a fresh letter of the same kind takes its place. */
export function replaceOffer(offers: readonly Offer[], index: number, rng: Rng): Offer[] {
  const used = offers[index];
  if (!used) return [...offers];
  const others = offers.filter((_, i) => i !== index);
  const next = [...offers];
  next[index] = { kind: used.kind, letter: drawLetter(used.kind, others, rng) };
  return next;
}
