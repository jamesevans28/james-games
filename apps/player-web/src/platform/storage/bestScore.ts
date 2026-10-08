/**
 * Per-device best score for each game, stored under one key: `g4j:best:<gameId>`.
 *
 * Games used to write their own keys (`<id>-best`, `<id>-best-score`) and the feed
 * tile read a third (`best_score_<id>`), so "Your best" never showed. The first read
 * migrates the highest legacy value into the new key. Never throws: storage can be
 * unavailable (private mode, blocked site data).
 */
const keyFor = (gameId: string) => `g4j:best:${gameId}`;
const legacyKeys = (gameId: string) => [
  `${gameId}-best`,
  `${gameId}-best-score`,
  `best_score_${gameId}`,
];

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readNumber(store: Storage, key: string): number {
  try {
    const n = Number(store.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function getBest(gameId: string): number {
  const store = storage();
  if (!store) return 0;
  const current = readNumber(store, keyFor(gameId));
  if (current > 0) return current;
  const migrated = Math.max(0, ...legacyKeys(gameId).map((k) => readNumber(store, k)));
  if (migrated > 0) {
    try {
      store.setItem(keyFor(gameId), String(migrated));
    } catch {
      // ignore storage failures
    }
  }
  return migrated;
}

/** Records `score` if it beats the stored best. Returns the best after the update. */
export function setBest(gameId: string, score: number): number {
  const best = Math.max(getBest(gameId), Number.isFinite(score) ? score : 0);
  const store = storage();
  if (store) {
    try {
      store.setItem(keyFor(gameId), String(best));
    } catch {
      // ignore storage failures
    }
  }
  return best;
}
