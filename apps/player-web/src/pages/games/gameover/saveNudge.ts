import { STORAGE_KEYS } from "../../../utils/storageKeys";

/**
 * The game-over "Save your progress" link for guests (anonymous accounts or no
 * session) shows at most once per local calendar day. Signed-in players never see it.
 */
export function shouldShowSaveNudge({
  isGuest,
  lastShownAt,
  now,
}: {
  isGuest: boolean;
  /** When it last showed (ms since epoch), or null if never. */
  lastShownAt: number | null;
  now: number;
}): boolean {
  if (!isGuest) return false;
  if (lastShownAt === null || !Number.isFinite(lastShownAt)) return true;
  if (lastShownAt > now) return false; // clock moved back: wait until it catches up
  return new Date(lastShownAt).toDateString() !== new Date(now).toDateString();
}

/** Reads the last-shown time. Never throws: storage can be missing or blocked. */
export function readSaveNudgeShownAt(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.saveNudgeShownAt);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function markSaveNudgeShown(now: number): void {
  try {
    localStorage.setItem(STORAGE_KEYS.saveNudgeShownAt, String(now));
  } catch {
    // storage blocked or full: the link may show again today, which is harmless
  }
}
