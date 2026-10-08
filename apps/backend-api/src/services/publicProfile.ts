import type { User } from "../db/schema.js";

/**
 * The only user fields that may appear in a response another person can see
 * (T7.6: screen name, avatar and level; stickers are added by the profile service).
 * Anything not listed here (email, admin, betaTester, prefs, username, friend code,
 * lastSeenAt, streaks, XP totals, dates, PIN data, ...) must never leave the server
 * through a public route. Add a field here only if it is safe for any stranger to read.
 */
export type PublicProfile = {
  userId: string;
  screenName: string;
  avatar: number;
  level: number;
};

export function toPublicProfile(user: User): PublicProfile {
  return {
    userId: user.id,
    screenName: user.screenName,
    avatar: user.avatar,
    level: user.xpLevel,
  };
}
