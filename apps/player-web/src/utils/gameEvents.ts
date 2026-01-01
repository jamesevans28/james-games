export type GameOverDetail = {
  gameId: string;
  score: number;
  ts?: number;
  /** Duration of the game session in milliseconds */
  durationMs?: number;
};

const EVENT_NAME = "game:over";
const START_EVENT_NAME = "game:start";

// Track game start times by gameId
const gameStartTimes = new Map<string, number>();

/**
 * Dispatch when a game starts. This starts the internal timer.
 */
export function dispatchGameStart(gameId: string) {
  if (typeof window === "undefined") return;
  gameStartTimes.set(gameId, Date.now());
  try {
    window.dispatchEvent(new CustomEvent(START_EVENT_NAME, { detail: { gameId } }));
  } catch {
    // no-op
  }
}

/**
 * Get the duration since game start in milliseconds.
 * Returns undefined if the game was never started.
 */
export function getGameDuration(gameId: string): number | undefined {
  const startTime = gameStartTimes.get(gameId);
  if (!startTime) return undefined;
  return Date.now() - startTime;
}

/**
 * Clear the game start time (called after game over is dispatched).
 */
function clearGameStartTime(gameId: string) {
  gameStartTimes.delete(gameId);
}

export function dispatchGameOver(detail: GameOverDetail) {
  if (typeof window === "undefined") return;

  // Auto-calculate duration if not provided
  if (detail.durationMs === undefined) {
    const duration = getGameDuration(detail.gameId);
    if (duration !== undefined) {
      detail.durationMs = duration;
    }
  }

  // Clear the start time
  clearGameStartTime(detail.gameId);

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

export function onGameStart(handler: (detail: { gameId: string }) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (ev: Event) => {
    const ce = ev as CustomEvent<{ gameId: string }>;
    if (ce?.detail) handler(ce.detail);
  };
  window.addEventListener(START_EVENT_NAME, listener as EventListener, { passive: true } as any);
  return () => window.removeEventListener(START_EVENT_NAME, listener as EventListener);
}
