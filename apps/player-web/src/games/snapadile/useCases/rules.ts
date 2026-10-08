/** Snapadile rules: pure functions, no Phaser. */

export const MAX_LIVES = 3;

export type SpawnSchedule = {
  /** Time until the next spawn attempt. */
  intervalMs: number;
  /** How many crocs may swim at once. */
  maxConcurrent: number;
  /** Croc swim speed in px/s. */
  crocSpeed: number;
};

/**
 * Difficulty as a function of time played (pauses excluded). Every 4 s the gap
 * between crocs shrinks by 80 ms down to 300 ms; roughly every 9 s one more croc
 * may swim at once, up to 6; faster spawns mean faster crocs.
 */
export function spawnSchedule(elapsedMs: number): SpawnSchedule {
  const t = Math.max(0, elapsedMs);
  const intervalMs = Math.max(300, 1000 - 80 * Math.floor(t / 4000));
  const maxConcurrent = Math.min(6, 1 + Math.floor(t / 9000));
  const crocSpeed = 200 + (1000 - intervalMs) * 0.2;
  return { intervalMs, maxConcurrent, crocSpeed };
}

/** One point per croc scared away. */
export const scoreFor = (hit: { retreating: boolean }): number => (hit.retreating ? 0 : 1);

export function loseLife(lives: number): number {
  return Math.max(0, lives - 1);
}

/** A free spawn point, or null when all are taken. */
export function pickSpawn<T extends { id: string }>(
  points: readonly T[],
  occupied: ReadonlySet<string>,
  rng: () => number,
): T | null {
  const free = points.filter((p) => !occupied.has(p.id));
  if (free.length === 0) return null;
  return free[Math.min(free.length - 1, Math.floor(rng() * free.length))] ?? null;
}
