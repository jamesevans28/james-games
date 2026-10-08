/** Picking the starting letters: pure functions, no Phaser. */

export const VOWELS: readonly string[] = ["A", "E", "I", "O", "U"];
export const CONSONANTS: readonly string[] = Array.from("BCDFGHJKLMNPQRSTVWXYZ");

/** How many of each the player picks before the game starts. */
export const PICKS = { consonants: 4, vowels: 2 } as const;

export const isVowel = (letter: string): boolean => VOWELS.includes(letter);

const countKind = (picks: readonly string[], vowel: boolean) =>
  picks.filter((l) => isVowel(l) === vowel).length;

/**
 * Tapping a letter: picked letters are unpicked; a new one is added unless that
 * kind is already full, in which case `ok` is false and nothing changes.
 */
export function togglePick(
  picks: readonly string[],
  letter: string,
): { picks: string[]; ok: boolean } {
  if (picks.includes(letter)) return { picks: picks.filter((l) => l !== letter), ok: true };
  const vowel = isVowel(letter);
  const limit = vowel ? PICKS.vowels : PICKS.consonants;
  if (countKind(picks, vowel) >= limit) return { picks: [...picks], ok: false };
  return { picks: [...picks, letter], ok: true };
}

/** Ready to start: exactly 4 consonants and 2 vowels. */
export function picksComplete(picks: readonly string[]): boolean {
  return countKind(picks, false) === PICKS.consonants && countKind(picks, true) === PICKS.vowels;
}
