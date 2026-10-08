/**
 * The seed for "today" in the player's local time, as the number YYYYMMDD
 * (9 October 2026 → 20261009). Everyone playing on the same calendar day gets
 * the same seed, so `host.rng(dailySeed(new Date()))` replays the same choices.
 *
 * Lives here until the SDK grows its daily-challenge helper (Phase 11), then moves there.
 */
export function dailySeed(date: Date): number {
  return date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate();
}
