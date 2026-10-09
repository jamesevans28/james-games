/**
 * Daily challenge rules on the device (T11.3). dailySeedFor and dailyGameFor
 * mirror apps/backend-api/src/services/dailyRules.ts (the server is the
 * authority for which run counts); both test files pin the same values.
 */

const DAY_MS = 86_400_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** FNV-1a, 32 bits: a small, stable string hash. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** True for a YYYY-MM-DD string that is a real calendar day. */
export function isDay(day: unknown): day is string {
  if (typeof day !== "string" || !DAY.test(day)) return false;
  const ms = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === day;
}

/** This device's local date (YYYY-MM-DD), the same day the server works out from its offset. */
export function localDay(nowMs: number = Date.now()): string {
  const offsetMinutes = -new Date(nowMs).getTimezoneOffset();
  return new Date(nowMs + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** The seed host.rng() uses on a day's challenge: same day, same spawns for everyone. */
export function dailySeedFor(day: string): number {
  return hash32(`g4j-daily:${day}`);
}

function shuffledBlock(block: number, ids: readonly string[]): string[] {
  return ids
    .map((id) => ({ id, key: hash32(`g4j-rotation:${block}:${id}`) }))
    .sort((a, b) => a.key - b.key || (a.id < b.id ? -1 : 1))
    .map((x) => x.id);
}

/**
 * The day's game from a list of active game ids. Only a fallback for when the
 * server can't be reached; GET /daily is the answer that counts.
 */
export function dailyGameFor(day: string, gameIds: readonly string[]): string | null {
  const ids = [...new Set(gameIds)].sort();
  if (ids.length === 0) return null;
  const n = Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
  const block = Math.floor(n / ids.length);
  const order = shuffledBlock(block, ids);
  const previous = shuffledBlock(block - 1, ids);
  if (ids.length > 1 && order[0] === previous[previous.length - 1]) {
    [order[0], order[1]] = [order[1]!, order[0]!];
  }
  return order[n - block * ids.length]!;
}

/** The link that starts a day's challenge run. */
export function dailyPlayPath(gameId: string, day: string): string {
  return `/games/${encodeURIComponent(gameId)}?daily=${day}`;
}

/**
 * The daily run settings for a game page, from its `?daily=` value: only for
 * today (a link from yesterday plays as a normal game).
 */
export function dailyRunFor(
  param: string | null,
  nowMs: number = Date.now(),
): { day: string; seed: number } | undefined {
  if (!isDay(param) || param !== localDay(nowMs)) return undefined;
  return { day: param, seed: dailySeedFor(param) };
}

/** "Friday 9 October" for a YYYY-MM-DD day, in the device's language. */
export function dayLabel(day: string, locale?: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
