import { brand, siteUrl } from "../../../config/brand";

/**
 * Sharing a score (T11.5). The link is always the public site's `/s/<playId>`
 * (never the app's own origin, which is localhost in dev and capacitor:// in the
 * apps): chat apps show its card with the score, and people land on the game.
 */
export function shareLinkFor(playId: string): string {
  return siteUrl(`/s/${encodeURIComponent(playId)}`);
}

export function shareDataFor(args: { playId: string; score: number; gameTitle?: string }): {
  title: string;
  text: string;
  url: string;
} {
  const where = args.gameTitle ? ` on ${args.gameTitle}` : "";
  return {
    title: args.gameTitle ? `${args.gameTitle} on ${brand.name}` : brand.name,
    text: `I scored ${args.score}${where}! Can you beat it?`,
    url: shareLinkFor(args.playId),
  };
}
