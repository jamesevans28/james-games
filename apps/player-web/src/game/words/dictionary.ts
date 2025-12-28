import wordsRaw from "./wordlist-5.txt?raw";

let memoizedSet: Set<string> | null = null;

function normalize(word: string): string {
  return word.trim().toUpperCase();
}

export function getFiveLetterWordSet(): Set<string> {
  if (memoizedSet) return memoizedSet;

  const set = new Set<string>();
  for (const line of wordsRaw.split(/\r?\n/)) {
    const w = line.trim();
    if (!w) continue;
    set.add(w);
  }

  memoizedSet = set;
  return set;
}

export function isValidEnglishFiveLetterWord(word: string): boolean {
  const w = normalize(word);
  if (!/^[A-Z]{5}$/.test(w)) return false;
  return getFiveLetterWordSet().has(w);
}
