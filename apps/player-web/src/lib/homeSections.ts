/**
 * The home grid's sections (T7.1), as pure functions. Replaces the old cycling feed:
 * no server ranking, no infinite loop, the same order every visit.
 */

/** The fields of a game the ordering needs. */
export type Orderable = {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
};

/** A game counts as "New" for this many days after it first appears. */
export const NEW_FOR_DAYS = 30;
/** "Play again" shows at most this many (two rows of two). */
export const PLAY_AGAIN_MAX = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

function time(iso?: string): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Recently played first (most recent first), then the most recently updated, then
 * by title. `recentIds` is newest first (utils/playHistory.ts).
 */
export function orderGames<T extends Orderable>(
  games: readonly T[],
  recentIds: readonly string[],
): T[] {
  const rank = new Map(recentIds.map((id, i) => [id, i]));
  return [...games].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra !== undefined || rb !== undefined) {
      if (ra === undefined) return 1;
      if (rb === undefined) return -1;
      return ra - rb;
    }
    const byUpdate = time(b.updatedAt) - time(a.updatedAt);
    if (byUpdate !== 0) return byUpdate;
    return a.title.localeCompare(b.title);
  });
}

export function isNewGame(game: Orderable, now: number, days = NEW_FOR_DAYS): boolean {
  const created = time(game.createdAt);
  return created > 0 && now - created >= 0 && now - created < days * DAY_MS;
}

export type HomeSections<T> = { fresh: T[]; playAgain: T[]; all: T[] };

/**
 * New: created in the last NEW_FOR_DAYS, newest first. Play again: games played on
 * this device, most recent first. All games: every game, in `orderGames` order.
 */
export function buildHomeSections<T extends Orderable>(
  games: readonly T[],
  recentIds: readonly string[],
  now: number,
): HomeSections<T> {
  const byId = new Map(games.map((g) => [g.id, g]));
  const playAgain = recentIds
    .map((id) => byId.get(id))
    .filter((g): g is T => g !== undefined)
    .slice(0, PLAY_AGAIN_MAX);
  const fresh = games
    .filter((g) => isNewGame(g, now))
    .sort((a, b) => time(b.createdAt) - time(a.createdAt));
  return { fresh, playAgain, all: orderGames(games, recentIds) };
}
