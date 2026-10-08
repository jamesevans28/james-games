import { getDb, type Db } from "../db/client.js";
import type { User } from "../db/schema.js";
import { getUserById } from "../repos/usersRepo.js";
import { lockUser, updateUserProgress } from "../repos/statsRepo.js";
import { clampTzOffset, localDayFor, nextStreak, type StreakState } from "./streakRules.js";

export type StreakData = StreakState;

export type StreakResult = { streak: StreakData; extended: boolean; isNewStreak: boolean };

export class UserNotFound extends Error {
  constructor() {
    super("user_not_found");
  }
}

/** The streak columns of a users row, in the API's shape. */
export function streakOf(
  user: Pick<User, "streakCurrent" | "streakLongest" | "streakLastDay">,
): StreakData {
  return {
    currentStreak: user.streakCurrent,
    longestStreak: user.streakLongest,
    lastLoginDate: user.streakLastDay,
  };
}

export async function getStreakData(userId: string): Promise<StreakData> {
  const user = await getUserById(userId);
  return user ? streakOf(user) : { currentStreak: 0, longestStreak: 0, lastLoginDate: null };
}

/**
 * Counts today for a locked user row inside a transaction. The day comes from
 * the server clock plus the player's clamped UTC offset, never from the client.
 */
export async function applyDailyStreak(
  tx: Db,
  user: User,
  tzOffsetMinutes: unknown,
  nowMs: number = Date.now(),
): Promise<StreakResult> {
  const today = localDayFor(nowMs, clampTzOffset(tzOffsetMinutes));
  const current = streakOf(user);
  const outcome = nextStreak(current, today);
  if (!outcome.changed) return { streak: current, extended: false, isNewStreak: false };
  await updateUserProgress(tx, user.id, {
    streakCurrent: outcome.next.currentStreak,
    streakLongest: outcome.next.longestStreak,
    streakLastDay: outcome.next.lastLoginDate,
  });
  return { streak: outcome.next, extended: outcome.extended, isNewStreak: outcome.isNewStreak };
}

/** Daily check-in. The user row is locked, so concurrent check-ins count once. */
export async function recordDailyLogin(
  userId: string,
  tzOffsetMinutes: unknown,
  nowMs: number = Date.now(),
): Promise<StreakResult> {
  return getDb().transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!user) throw new UserNotFound();
    return applyDailyStreak(tx, user, tzOffsetMinutes, nowMs);
  });
}

export default {
  getStreakData,
  recordDailyLogin,
};
