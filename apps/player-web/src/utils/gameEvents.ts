export type GameOverDetail = {
  gameId: string;
  score: number;
  ts?: number;
};

const EVENT_NAME = "game:over";

export function dispatchGameOver(detail: GameOverDetail) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent<GameOverDetail>(EVENT_NAME, { detail }));
  } catch {
    // no-op
  }
}

export function onGameOver(handler: (detail: GameOverDetail) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (ev: Event) => {
    const ce = ev as CustomEvent<GameOverDetail>;
    if (ce?.detail) handler(ce.detail);
  };
  window.addEventListener(EVENT_NAME, listener as EventListener, { passive: true } as any);
  return () => window.removeEventListener(EVENT_NAME, listener as EventListener);
}
