import { getDb, type Db } from "../db/client.js";
import type { User } from "../db/schema.js";
import { getUserById } from "../repos/usersRepo.js";
import { listLocalPlayDays, lockUser, updateUserProgress } from "../repos/statsRepo.js";
import { awardSticker, hasSticker, listStickers } from "../repos/stickersRepo.js";
import {
  clampTzOffset,
  localDayFor,
  localWeekFor,
  nextStreak,
  weeklyStickerFor,
  type StreakState,
} from "./streakRules.js";

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

export type StickerEarned = { id: string; kind: "weekly" };

/**
 * The weekly sticker (T7.5), inside the score transaction after the play is
 * inserted: collected the first time this local ISO week has plays on 3
 * different days. Days are the server's play times shifted by the player's
 * clamped UTC offset. Returns the sticker only when this run collected it.
 */
export async function applyWeeklySticker(
  tx: Db,
  userId: string,
  tzOffsetMinutes: unknown,
  nowMs: number = Date.now(),
): Promise<StickerEarned | null> {
  const week = localWeekFor(nowMs, tzOffsetMinutes);
  if (await hasSticker(tx, userId, week.stickerId)) return null;
  const days = await listLocalPlayDays(tx, userId, week);
  // Today always counts: this run's play is part of the week even at its edges.
  const id = weeklyStickerFor([...days, week.today], week.today);
  if (!id) return null;
  const collected = await awardSticker(tx, { userId, stickerId: id, earnedAt: new Date(nowMs) });
  return collected ? { id, kind: "weekly" } : null;
}

/** A player's collected stickers, newest first. */
export async function listUserStickers(
  userId: string,
): Promise<Array<{ id: string; earnedAt: string }>> {
  const rows = await listStickers(userId);
  return rows.map((r) => ({ id: r.stickerId, earnedAt: r.earnedAt.toISOString() }));
}

export default {
  getStreakData,
  recordDailyLogin,
  listUserStickers,
};
