/** localStorage keys use the `g4j:` prefix (brand.storagePrefix). */
export const STORAGE_KEYS = {
  lastPlayed: "g4j:lastPlayed",
  catalog: "g4j:catalog",
  /** Per-game rating prompt state: { [gameId]: { plays, lastPromptAt } } (T7.4). */
  ratingPrompt: "g4j:ratingPrompt",
  /** Last leaderboard tab picked ("overall" | "following"). */
  leaderboardTab: "g4j:leaderboardTab",
  /** When the game-over "Save your progress" link last showed to a guest (ms). */
  saveNudgeShownAt: "g4j:saveNudgeShownAt",
  /** When the player last opened Notifications (ms): newer friend requests light the dot. */
  notificationsSeenAt: "g4j:notificationsSeenAt",
} as const;

/** Reads a stored value. Never throws: storage can be missing, blocked or full. */
export function readStored(name: keyof typeof STORAGE_KEYS): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS[name]);
  } catch {
    return null;
  }
}
