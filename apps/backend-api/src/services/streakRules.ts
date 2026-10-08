/** Pure streak rules. The calendar day always comes from the server clock. */

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: string | null;
};

const MAX_TZ_OFFSET_MINUTES = 14 * 60;

/** Clamp a client-reported UTC offset (minutes east of UTC) to the real-world range. */
export function clampTzOffset(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(-MAX_TZ_OFFSET_MINUTES, Math.min(MAX_TZ_OFFSET_MINUTES, Math.round(v)));
}

/** The player's local date (YYYY-MM-DD) for a server timestamp and a clamped offset. */
export function localDayFor(nowMs: number, tzOffsetMinutes: number): string {
  return new Date(nowMs + clampTzOffset(tzOffsetMinutes) * 60_000).toISOString().slice(0, 10);
}

function previousDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type StreakOutcome = {
  next: StreakState;
  changed: boolean;
  extended: boolean;
  isNewStreak: boolean;
};

export function nextStreak(current: StreakState, today: string): StreakOutcome {
  const unchanged = { next: current, changed: false, extended: false, isNewStreak: false };
  // Same day, or a day before the last recorded one (offset games): no change.
  if (current.lastLoginDate && today <= current.lastLoginDate) return unchanged;

  const consecutive = current.lastLoginDate === previousDay(today);
  const currentStreak = consecutive ? current.currentStreak + 1 : 1;
  return {
    next: {
      currentStreak,
      longestStreak: Math.max(current.longestStreak, currentStreak),
      lastLoginDate: today,
    },
    changed: true,
    extended: consecutive && currentStreak >= 2,
    isNewStreak: !consecutive && current.currentStreak > 0,
  };
}

// ---------------------------------------------------------------------------
// Weekly stickers (T7.5): the player-facing reward. Play on 3 different days in
// one ISO week (Monday to Sunday, in the player's local time) to collect that
// week's sticker. The daily streak above stays internal.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Days of play in one week that collect the weekly sticker. */
export const WEEKLY_STICKER_DAYS = 3;

/** ISO 8601 week of a YYYY-MM-DD day: weeks start on Monday, week 1 holds the first Thursday. */
export function isoWeekOf(day: string): { isoYear: number; isoWeek: number } {
  const d = new Date(`${day}T00:00:00Z`);
  const weekday = d.getUTCDay() || 7; // Monday 1 … Sunday 7
  d.setUTCDate(d.getUTCDate() + 4 - weekday); // the Thursday of this week decides the year
  const isoYear = d.getUTCFullYear();
  const isoWeek = Math.floor((d.getTime() - Date.UTC(isoYear, 0, 1)) / DAY_MS / 7) + 1;
  return { isoYear, isoWeek };
}

/** Sticker id for the ISO week holding a day, e.g. `week-2026-41`. */
export function weeklyStickerId(day: string): string {
  const { isoYear, isoWeek } = isoWeekOf(day);
  return `week-${isoYear}-${String(isoWeek).padStart(2, "0")}`;
}

export type LocalWeek = {
  /** The player's local date now. */
  today: string;
  /** The clamped offset used for every day in this week. */
  tzOffsetMinutes: number;
  /** UTC instants bounding the player's local Monday 00:00 to next Monday 00:00. */
  startMs: number;
  endMs: number;
  stickerId: string;
};

/** The player's current local ISO week, as a UTC window for querying plays. */
export function localWeekFor(nowMs: number, tzOffsetMinutes: unknown): LocalWeek {
  const offset = clampTzOffset(tzOffsetMinutes);
  const today = localDayFor(nowMs, offset);
  const todayStartUtc = Date.parse(`${today}T00:00:00Z`);
  const weekday = new Date(todayStartUtc).getUTCDay() || 7;
  const startMs = todayStartUtc - (weekday - 1) * DAY_MS - offset * 60_000;
  return {
    today,
    tzOffsetMinutes: offset,
    startMs,
    endMs: startMs + 7 * DAY_MS,
    stickerId: weeklyStickerId(today),
  };
}

/**
 * The weekly sticker id when the player's local play days include
 * WEEKLY_STICKER_DAYS different days in today's ISO week, otherwise null.
 */
export function weeklyStickerFor(playDays: readonly string[], today: string): string | null {
  const week = weeklyStickerId(today);
  const days = new Set(playDays.filter((d) => weeklyStickerId(d) === week));
  return days.size >= WEEKLY_STICKER_DAYS ? week : null;
}
