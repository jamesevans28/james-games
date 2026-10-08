/** localStorage keys use the `g4j:` prefix (brand.storagePrefix). */
export const STORAGE_KEYS = {
  lastPlayed: "g4j:lastPlayed",
  catalog: "g4j:catalog",
} as const;

/** Reads a stored value. Never throws: storage can be missing, blocked or full. */
export function readStored(name: keyof typeof STORAGE_KEYS): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS[name]);
  } catch {
    return null;
  }
}
