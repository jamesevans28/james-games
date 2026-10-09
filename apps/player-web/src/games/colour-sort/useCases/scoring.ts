/** Points for clearing a level. */
export const LEVEL_POINTS = 100;
/** Extra points for clearing a level within par. */
export const MAX_BONUS = 50;
/** Bonus lost for every move over par. */
export const BONUS_STEP = 5;
/** The run ends after this level, so every run finishes and posts a score. */
export const LAST_LEVEL = 20;
/** The most a run can score: every level cleared within par. */
export const MAX_SCORE = LAST_LEVEL * (LEVEL_POINTS + MAX_BONUS);

/** The fewer-moves bonus: 50 at or under par, 5 less per extra move, never below 0. */
export function moveBonus(moves: number, par: number): number {
  const over = Math.max(0, moves - par);
  return Math.max(0, MAX_BONUS - over * BONUS_STEP);
}

/** What clearing one level in `moves` moves is worth. */
export function levelScore(moves: number, par: number): number {
  return LEVEL_POINTS + moveBonus(moves, par);
}

/** True once `cleared` levels finish the run. */
export function isLastLevel(cleared: number): boolean {
  return cleared >= LAST_LEVEL;
}
