/**
 * localStorage keys use the `g4j:` prefix (brand.storagePrefix). Keys from the
 * flingo era are moved over once by `readMigrated`; drop the legacy names after
 * one release (T3.1).
 */
export const STORAGE_KEYS = {
  lastPlayed: "g4j:lastPlayed",
  catalog: "g4j:catalog",
} as const;

export const LEGACY_STORAGE_KEYS: Record<keyof typeof STORAGE_KEYS, string> = {
  lastPlayed: "flingo_last_played_games",
  catalog: "flingo_game_catalog_cache",
};

/**
 * Reads `key`, first moving a value stored under the legacy name across if the
 * new key is empty. Never throws: storage can be missing or full.
 */
export function readMigrated(name: keyof typeof STORAGE_KEYS): string | null {
  try {
    const key = STORAGE_KEYS[name];
    const legacy = LEGACY_STORAGE_KEYS[name];
    const current = localStorage.getItem(key);
    const old = localStorage.getItem(legacy);
    if (old !== null) {
      if (current === null) localStorage.setItem(key, old);
      localStorage.removeItem(legacy);
      return current ?? old;
    }
    return current;
  } catch {
    return null;
  }
}
