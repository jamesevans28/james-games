// Minimal GA4 helper using the gtag snippet already in index.html

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export type GameEventParams = Record<string, string | number | boolean | undefined>;

export function gaEvent(eventName: string, params?: GameEventParams) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, params || {});
  }
}

export function trackGameStart(gameId: string, gameName: string) {
  gaEvent("game_start", {
    game_id: gameId,
    game_name: gameName,
  });
}
