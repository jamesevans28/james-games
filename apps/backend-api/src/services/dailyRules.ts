/**
 * Pure daily-challenge rules (T11.3). The player app mirrors dailySeedFor and
 * dailyGameFor in src/pages/daily/dailyRules.ts; both test files pin the same
 * values, so a change here must be made there too.
 */

const DAY_MS = 86_400_000;

/** FNV-1a, 32 bits: a small, stable string hash. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Days since 1970-01-01 for a YYYY-MM-DD day. */
function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

/**
 * The seed every player's daily run uses (host.rng() with no seed). Same day,
 * same seed, so everyone gets the same spawn sequence.
 */
export function dailySeedFor(day: string): number {
  return hash32(`g4j-daily:${day}`);
}

/** The shuffled order of one block of days, before the no-repeat fix. */
function shuffledBlock(block: number, ids: readonly string[]): string[] {
  return ids
    .map((id) => ({ id, key: hash32(`g4j-rotation:${block}:${id}`) }))
    .sort((a, b) => a.key - b.key || (a.id < b.id ? -1 : 1))
    .map((x) => x.id);
}

/**
 * Today's game: a rotation over the given game ids. Each block of N days (N =
 * number of games) plays every game once, in an order shuffled by the block
 * number, so the pick is the same for everyone and doesn't follow the alphabet.
 * With three or more games, a block never starts with the game that ended the
 * one before. Null when there are no games.
 */
export function dailyGameFor(day: string, gameIds: readonly string[]): string | null {
  const ids = [...new Set(gameIds)].sort();
  if (ids.length === 0) return null;
  const n = dayNumber(day);
  const block = Math.floor(n / ids.length);
  const order = shuffledBlock(block, ids);
  const previous = shuffledBlock(block - 1, ids);
  if (ids.length > 1 && order[0] === previous[previous.length - 1]) {
    [order[0], order[1]] = [order[1]!, order[0]!];
  }
  return order[n - block * ids.length]!;
}

/** Monday and Sunday (YYYY-MM-DD) of the ISO week holding a day. */
export function isoWeekBounds(day: string): { monday: string; sunday: string } {
  const start = Date.parse(`${day}T00:00:00Z`);
  const weekday = new Date(start).getUTCDay() || 7; // Monday 1 … Sunday 7
  const monday = start - (weekday - 1) * DAY_MS;
  return {
    monday: new Date(monday).toISOString().slice(0, 10),
    sunday: new Date(monday + 6 * DAY_MS).toISOString().slice(0, 10),
  };
}
