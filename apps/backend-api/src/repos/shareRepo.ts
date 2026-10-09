import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { games, plays, remixes, users, type Game } from "../db/schema.js";

/** Pure data access for share cards (T11.5). The service decides what may be shown. */

export type SharePlayRow = {
  playId: string;
  gameId: string;
  gameTitle: string;
  gameStatus: Game["status"];
  score: number;
  /** Null when the player deleted their account (the play is kept, anonymised). */
  screenName: string | null;
  disabled: boolean;
  /** Set when the run was played on a saved remix (T11.2). */
  remixName: string | null;
};

/** One play with its game, player and remix, in one query; null when there is no such play. */
export async function getSharePlay(playId: string): Promise<SharePlayRow | null> {
  const [row] = await getDb()
    .select({
      playId: plays.id,
      gameId: plays.gameId,
      gameTitle: games.title,
      gameStatus: games.status,
      score: plays.score,
      screenName: users.screenName,
      disabledAt: users.disabledAt,
      remixName: remixes.name,
    })
    .from(plays)
    .innerJoin(games, eq(games.id, plays.gameId))
    .leftJoin(users, eq(users.id, plays.userId))
    .leftJoin(remixes, eq(remixes.id, plays.remixId))
    .where(eq(plays.id, playId))
    .limit(1);
  if (!row) return null;
  const { disabledAt, ...rest } = row;
  return { ...rest, disabled: disabledAt !== null };
}
