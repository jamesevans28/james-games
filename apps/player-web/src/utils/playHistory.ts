import { readMigrated, STORAGE_KEYS } from "./storageKeys";

/** Recently played games, newest first, kept in localStorage on this device. */
const LAST_PLAYED_KEY = STORAGE_KEYS.lastPlayed;
const MAX_LAST_PLAYED = 10;

export function getLastPlayedGames(): string[] {
  try {
    const stored = readMigrated("lastPlayed");
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function recordGamePlayed(gameId: string): void {
  try {
    const current = getLastPlayedGames().filter((id) => id !== gameId);
    localStorage.setItem(
      LAST_PLAYED_KEY,
      JSON.stringify([gameId, ...current].slice(0, MAX_LAST_PLAYED)),
    );
  } catch {
    // localStorage not available
  }
}
