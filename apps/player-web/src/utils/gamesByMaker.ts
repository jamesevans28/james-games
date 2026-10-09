/** The bits of a game the About page's "by maker" list needs (T11.1). */
export type MakerGame = { id: string; title: string; noteBy?: string };

export type MakerGroup<G extends MakerGame> = {
  /** A maker's name, or null for games everyone made together. */
  maker: string | null;
  games: G[];
};

/**
 * Groups games by the kid who dreamed them up (`noteBy`), in the order of
 * `makers`. Makers with no games are left out; games whose designer isn't in
 * `makers` (or have none) go in a final "everyone" group. Titles are sorted A–Z.
 */
export function gamesByMaker<G extends MakerGame>(
  games: readonly G[],
  makers: readonly string[],
): MakerGroup<G>[] {
  const byTitle = (a: G, b: G) => a.title.localeCompare(b.title);
  const groups: MakerGroup<G>[] = [];
  for (const maker of makers) {
    const mine = games.filter((g) => g.noteBy === maker).sort(byTitle);
    if (mine.length) groups.push({ maker, games: mine });
  }
  const rest = games.filter((g) => !g.noteBy || !makers.includes(g.noteBy)).sort(byTitle);
  if (rest.length) groups.push({ maker: null, games: rest });
  return groups;
}
