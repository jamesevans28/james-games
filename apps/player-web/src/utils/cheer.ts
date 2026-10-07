export type Cheer = { headline: string; isNewBest: boolean };

/** What the game-over dialog says, based on this run against the best before it. */
export function cheerFor(score: number | null | undefined, previousBest: number): Cheer {
  const s = Number(score) || 0;
  if (s <= 0) return { headline: "Have another go!", isNewBest: false };
  if (s > previousBest) return { headline: "New best!", isNewBest: true };
  if (s === previousBest) return { headline: "You matched your best!", isNewBest: false };
  return { headline: "Nice run!", isNewBest: false };
}
