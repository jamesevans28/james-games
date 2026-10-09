/**
 * Per-device best score for each game, stored under one key: `g4j:best:<gameId>`.
 * Never throws: the storage adapter swallows unavailable storage (private mode, blocked site data).
 */
import { adapters } from "../adapters";

const keyFor = (gameId: string) => `g4j:best:${gameId}`;

export function getBest(gameId: string): number {
  const n = Number(adapters.storage.get(keyFor(gameId)));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Records `score` if it beats the stored best. Returns the best after the update. */
export function setBest(gameId: string, score: number): number {
  const best = Math.max(getBest(gameId), Number.isFinite(score) ? score : 0);
  adapters.storage.set(keyFor(gameId), String(best));
  return best;
}
