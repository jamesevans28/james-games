/** Word Rush rules: pure functions, no Phaser. */

/** What a hidden letter looks like in a `revealLetters` pattern. */
export const HIDDEN = "_";

/** Board limits: tiles per line (a space between words counts as one) and lines. */
export const BOARD = { maxLineLength: 10, maxLines: 4 } as const;

/** Buying a letter costs this much time, and is only allowed while this much is left after it. */
export const BUY_COST_MS = 30_000;
export const MIN_LEFT_AFTER_BUY_MS = 5_000;

/** Longest answer the input box takes (the longest phrase is 20 characters). */
export const MAX_INPUT = 24;

const isLetter = (ch: string): boolean => ch >= "A" && ch <= "Z" && ch.length === 1;

/** Upper-case A–Z only: "Bird's nest" → "BIRDSNEST". Guesses are compared like this. */
export function lettersOnly(text: string): string {
  return text.toUpperCase().replace(/[^A-Z]/g, "");
}

/**
 * The board pattern for a phrase: chosen letters show, other letters are `_`,
 * and spaces and punctuation always show. revealLetters("RED PANDA", "AR") → "R__ _A__A".
 */
export function revealLetters(phrase: string, chosen: Iterable<string>): string {
  const shown = new Set(chosen);
  return Array.from(phrase, (ch) => (isLetter(ch) && !shown.has(ch) ? HIDDEN : ch)).join("");
}

/** Letters in the phrase that are still hidden, each once, in phrase order. */
export function hiddenLetters(phrase: string, chosen: Iterable<string>): string[] {
  const shown = new Set(chosen);
  return [...new Set(Array.from(phrase).filter((ch) => isLetter(ch) && !shown.has(ch)))];
}

/** Kind to kids: case, spaces and punctuation don't matter ("toy story", "TOYSTORY"). */
export function isCorrect(guess: string, phrase: string): boolean {
  const target = lettersOnly(phrase);
  return target.length > 0 && lettersOnly(guess) === target;
}

/** Seconds on the clock for a level: 2 minutes for levels 1–3, then 5 s less a level, never under 90 s. */
export function timeFor(level: number): number {
  const extra = Math.max(0, level - 3);
  return Math.max(90_000, 120_000 - 5_000 * extra);
}

/** Letter count (spaces and punctuation excluded) a level's phrase may have. */
export function lengthBand(level: number): { min: number; max: number } {
  return level <= 3 ? { min: 1, max: 7 } : { min: 7, max: Number.POSITIVE_INFINITY };
}

/** The phrases of a category that suit a level: short ones for levels 1–3, longer from 4. */
export function phrasesFor(level: number, phrases: readonly string[]): string[] {
  const { min, max } = lengthBand(level);
  return phrases.filter((p) => {
    const n = lettersOnly(p).length;
    return n >= min && n <= max;
  });
}

/** Words grouped into board lines, each at most `maxLineLength` long with single spaces. */
export function boardLines(
  phrase: string,
  maxLineLength: number = BOARD.maxLineLength,
): string[][] {
  const lines: string[][] = [];
  let line: string[] = [];
  let length = 0;
  for (const word of phrase.split(" ").filter(Boolean)) {
    const needed = line.length > 0 ? length + 1 + word.length : word.length;
    if (line.length > 0 && needed > maxLineLength) {
      lines.push(line);
      line = [word];
      length = word.length;
    } else {
      line.push(word);
      length = needed;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

/**
 * True when the board can show the phrase: upper-case A–Z with single spaces, an
 * apostrophe or hyphen only inside a word, every word fits a line, and few enough lines.
 */
export function fitsBoard(phrase: string): boolean {
  if (!/^[A-Z]+(?:['-][A-Z]+)*(?: [A-Z]+(?:['-][A-Z]+)*)*$/.test(phrase)) return false;
  const lines = boardLines(phrase);
  return (
    lines.length <= BOARD.maxLines && lines.every((l) => l.join(" ").length <= BOARD.maxLineLength)
  );
}

export type Pick = { category: string; phrase: string };

/**
 * A random category, then a random phrase in it that suits the level and hasn't
 * been used this run. If every suitable phrase has been used, repeats are allowed.
 */
export function pickPhrase(
  level: number,
  categories: readonly { name: string; phrases: readonly string[] }[],
  rng: () => number,
  used: ReadonlySet<string> = new Set(),
): Pick | null {
  const pool = (allowRepeats: boolean) =>
    categories
      .map((c) => ({
        name: c.name,
        options: phrasesFor(level, c.phrases).filter((p) => allowRepeats || !used.has(p)),
      }))
      .filter((c) => c.options.length > 0);
  const fresh = pool(false);
  const choices = fresh.length > 0 ? fresh : pool(true);
  const category = pickOne(choices, rng);
  if (!category) return null;
  const phrase = pickOne(category.options, rng);
  return phrase ? { category: category.name, phrase } : null;
}

function pickOne<T>(items: readonly T[], rng: () => number): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/** Buying is allowed while a letter is still hidden and the clock can pay for it. */
export function canBuyLetter(msLeft: number, phrase: string, chosen: Iterable<string>): boolean {
  return msLeft >= BUY_COST_MS + MIN_LEFT_AFTER_BUY_MS && hiddenLetters(phrase, chosen).length > 0;
}

/** The letter a purchase reveals: a random still-hidden one, or null if none is left. */
export function pickLetterToBuy(
  phrase: string,
  chosen: Iterable<string>,
  rng: () => number,
): string | null {
  return pickOne(hiddenLetters(phrase, chosen), rng) ?? null;
}

/** Points for solving a level: one per second left, as the clock shows it. */
export function scoreFor(msLeft: number): number {
  return Math.ceil(Math.max(0, msLeft) / 1000);
}

/**
 * The answer after a key press: letters add, SPACE adds one space between words
 * (never at the start or twice), BACKSPACE removes the last character.
 */
export function typeKey(input: string, key: string): string {
  if (key === "BACKSPACE") return input.slice(0, -1);
  if (input.length >= MAX_INPUT) return input;
  if (key === "SPACE") return input.length > 0 && !input.endsWith(" ") ? `${input} ` : input;
  return /^[A-Z]$/.test(key) ? input + key : input;
}
