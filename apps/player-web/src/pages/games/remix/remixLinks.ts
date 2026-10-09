/** Links for a saved remix (T11.2), pure. */
import { SITE_URL } from "../../../utils/seoKeywords";

/** The in-app path that opens a game with a saved remix loaded. */
export function remixPath(gameId: string, remixId: string): string {
  return `/games/${encodeURIComponent(gameId)}?remix=${encodeURIComponent(remixId)}`;
}

/** The remix's own board on the leaderboard page. */
export function remixBoardPath(gameId: string, remixId: string): string {
  return `/leaderboard/${encodeURIComponent(gameId)}?remix=${encodeURIComponent(remixId)}`;
}

/** What the share sheet gets: the remix name, a friendly line and the full link. */
export function remixShareData(args: {
  gameId: string;
  gameTitle: string;
  remixId: string;
  name: string;
}): { title: string; text: string; url: string } {
  return {
    title: `${args.name} (${args.gameTitle} remix)`,
    text: `Try my ${args.gameTitle} remix, "${args.name}". Can you beat my score?`,
    url: `${SITE_URL}${remixPath(args.gameId, args.remixId)}`,
  };
}
