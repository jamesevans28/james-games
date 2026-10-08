/**
 * Game events (T7.9). Page views are counted by Cloudflare Web Analytics, which is
 * cookieless and has no custom events; game plays are counted first-party in the
 * `plays` table (admin dashboard). So these are no-ops in production and log in dev,
 * which keeps the SDK's host.analytics contract for games.
 */
export type GameEventParams = Record<string, string | number | boolean | undefined>;

export function gaEvent(eventName: string, params?: GameEventParams) {
  if (import.meta.env.DEV) console.debug("[analytics]", eventName, params ?? {});
}

export function trackGameStart(gameId: string, gameName: string) {
  gaEvent("game_start", { game_id: gameId, game_name: gameName });
}

export function trackShare(gameId: string, gameName: string, score?: number) {
  gaEvent("share", { game_id: gameId, game_name: gameName, score });
}
