import { getSharePlay, type SharePlayRow } from "../repos/shareRepo.js";

/**
 * Share cards (T11.5): what a shared score says, as a link preview page for chat
 * apps (og: and twitter: tags) and as the words on the 1200×630 image
 * (shareCardImage.ts). Only public things are shown: the screen name (never the
 * username), the game, the remix name and the score.
 */

export type ShareCard = {
  playId: string;
  gameId: string;
  gameTitle: string;
  score: number;
  /** The player's screen name, or null for a deleted or disabled account ("A player"). */
  playerName: string | null;
  remixName: string | null;
};

export const SHARE_DESCRIPTION = "Can you beat it?";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A play id as it appears in a share link, lower-cased; null when it can't be one. */
export function parseSharePlayId(value: string): string | null {
  return UUID.test(value) ? value.toLowerCase() : null;
}

/** What a play row may show. Plays on inactive (cut) games have no card. */
export function shareCardFor(row: SharePlayRow): ShareCard | null {
  if (row.gameStatus === "inactive") return null;
  const name = row.screenName?.trim();
  const remix = row.remixName?.trim();
  return {
    playId: row.playId,
    gameId: row.gameId,
    gameTitle: row.gameTitle,
    score: row.score,
    playerName: name && !row.disabled ? name : null,
    remixName: remix ? remix : null,
  };
}

/** The card for a play id from a link, or null (bad id, no such play, inactive game). */
export async function getShareCard(rawPlayId: string): Promise<ShareCard | null> {
  const playId = parseSharePlayId(rawPlayId);
  if (!playId) return null;
  const row = await getSharePlay(playId);
  return row ? shareCardFor(row) : null;
}

/** 12000 → "12,000" (no locale data needed). */
export function formatScore(score: number): string {
  return String(Math.trunc(score)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "Tilly scored 120 on Snapadile!" / "A player scored 120 on Croc Rush, a Snapadile remix!" */
export function shareHeadline(card: ShareCard): string {
  const who = card.playerName ?? "A player";
  const where = card.remixName ? `${card.remixName}, a ${card.gameTitle} remix` : card.gameTitle;
  return `${who} scored ${formatScore(card.score)} on ${where}!`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type ShareUrls = {
  /** The link people share: `<site>/s/<playId>` (served by the API through CloudFront). */
  shareUrl: string;
  imageUrl: string;
  /** Where people land: the game's page on the site. */
  gameUrl: string;
};

export function shareUrlsFor(card: ShareCard, siteOrigin: string): ShareUrls {
  const site = siteOrigin.replace(/\/+$/, "");
  const id = encodeURIComponent(card.playId);
  return {
    shareUrl: `${site}/s/${id}`,
    imageUrl: `${site}/s/${id}.png`,
    gameUrl: `${site}/games/${encodeURIComponent(card.gameId)}`,
  };
}

/**
 * The link-preview page. Bots read the tags (they don't run scripts); people are
 * sent straight on to the game by the script, with a plain link as a fallback.
 * No meta refresh: some crawlers follow it and would preview the game page instead.
 */
export function buildShareHtml(card: ShareCard, siteOrigin: string): string {
  const { shareUrl, imageUrl, gameUrl } = shareUrlsFor(card, siteOrigin);
  const title = escapeHtml(shareHeadline(card));
  const description = escapeHtml(SHARE_DESCRIPTION);
  const image = escapeHtml(imageUrl);
  // JSON is valid JS; escaping "<" keeps "</script>" out of the inline script.
  const target = JSON.stringify(gameUrl).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(shareUrl)}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${title}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
</head>
<body>
<p>${title} <a href="${escapeHtml(gameUrl)}">Play ${escapeHtml(card.gameTitle)}</a></p>
<script>location.replace(${target});</script>
</body>
</html>
`;
}

/** For a link that has no card: a tiny page that sends people to the home page. */
export function buildMissingShareHtml(siteOrigin: string): string {
  const home = `${siteOrigin.replace(/\/+$/, "")}/`;
  const target = JSON.stringify(home).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>Games</title>
</head>
<body>
<p><a href="${escapeHtml(home)}">Find a game to play</a></p>
<script>location.replace(${target});</script>
</body>
</html>
`;
}
