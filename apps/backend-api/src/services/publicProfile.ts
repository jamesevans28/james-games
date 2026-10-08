import type { User } from "../db/schema.js";
import { buildSummary, type ExperienceSummary } from "./experienceService.js";

/**
 * The only user fields that may appear in a response another person can see.
 * Anything not listed here (email, admin, betaTester, prefs, username, lastSeenAt,
 * streak day, updatedAt, PIN data, ...) must never leave the server through a
 * public route. Add a field here only if it is safe for any stranger to read.
 */
export type PublicProfile = {
  userId: string;
  screenName: string;
  avatar: number;
  createdAt: string;
  experience: ExperienceSummary;
  currentStreak: number;
  longestStreak: number;
};

export function toPublicProfile(user: User): PublicProfile {
  const xp = buildSummary(user);
  // lastUpdated is left out: it is the row's updatedAt, a last-activity time.
  const experience: ExperienceSummary = {
    level: xp.level,
    progress: xp.progress,
    required: xp.required,
    percent: xp.percent,
    remaining: xp.remaining,
    total: xp.total,
  };
  return {
    userId: user.id,
    screenName: user.screenName,
    avatar: user.avatar,
    createdAt: user.createdAt.toISOString(),
    experience,
    currentStreak: user.streakCurrent,
    longestStreak: user.streakLongest,
  };
}
