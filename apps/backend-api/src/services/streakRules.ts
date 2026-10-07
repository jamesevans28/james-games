/** Pure streak rules. The calendar day always comes from the server clock. */

export type StreakState = { currentStreak: number; longestStreak: number; lastLoginDate: string | null };

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
