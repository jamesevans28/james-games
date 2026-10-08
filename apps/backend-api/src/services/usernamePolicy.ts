/**
 * Pure rules for usernames, PINs and preferences (screen names: screenNames.ts). Uniqueness is not
 * checked here: the database's case-insensitive unique indexes decide that.
 */

/** Login names: 3-20 letters, digits or underscores. Stored lower-cased. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
/** PINs: exactly 6 digits for every account (T6.5, T7.7). */
export const PIN_PATTERN = /^\d{6}$/;

export const AVATAR_MAX = 1000;
/** Upper bound on the stored preferences object, as JSON. */
export const PREFS_MAX_BYTES = 4096;

export function isValidUsername(value: unknown): value is string {
  return typeof value === "string" && USERNAME_PATTERN.test(value);
}

export function normalizeUsername(username: string): string {
  return username.toLowerCase();
}

export function isValidPin(value: unknown): value is string {
  return typeof value === "string" && PIN_PATTERN.test(value);
}

export function isValidAvatar(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= AVATAR_MAX;
}

/** A plain JSON object no bigger than PREFS_MAX_BYTES. */
export function isValidPrefs(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    return JSON.stringify(value).length <= PREFS_MAX_BYTES;
  } catch {
    return false;
  }
}
