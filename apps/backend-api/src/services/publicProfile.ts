/**
 * The only user fields that may appear in a response another person can see.
 * Anything not listed here (email, admin, betaTester, preferences, lastLoginDate,
 * validated, updatedAt, PIN data, ...) must never leave the server through a
 * public route. Add a field here only if it is safe for any stranger to read.
 */
export type PublicProfile = {
  userId: string;
  screenName: string | null;
  avatar: number | string | null;
  createdAt: string | null;
  experience: unknown;
  currentStreak: number;
  longestStreak: number;
};

export function toPublicProfile(
  profile: Record<string, unknown> & { userId: string },
): PublicProfile {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    userId: profile.userId,
    screenName: typeof profile.screenName === "string" ? profile.screenName : null,
    avatar:
      typeof profile.avatar === "number" || typeof profile.avatar === "string"
        ? profile.avatar
        : null,
    createdAt: typeof profile.createdAt === "string" ? profile.createdAt : null,
    experience: profile.experience ?? null,
    currentStreak: num(profile.currentStreak),
    longestStreak: num(profile.longestStreak),
  };
}
