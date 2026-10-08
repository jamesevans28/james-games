import { aggregatePlays, getGame } from "../repos/gamesRepo.js";

/** Admin usage stats for one game over the last four weeks (SQL aggregates on plays). */

export type WeeklyStat = {
  start: string;
  end: string;
  label: string;
  count: number;
};

export type GameStats = {
  gameId: string;
  totalPlays: number;
  averageScore: number;
  uniquePlayers: number;
  weeklyBreakdown: WeeklyStat[];
  since: string;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKS = 4;

/** Four consecutive weeks ending at `nowMs`, oldest first. */
export function weekWindows(nowMs: number): Array<{ start: Date; end: Date }> {
  return Array.from({ length: WEEKS }, (_, i) => ({
    start: new Date(nowMs - WEEK_MS * (WEEKS - i)),
    end: new Date(nowMs - WEEK_MS * (WEEKS - i - 1)),
  }));
}

function weekLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

/** Null when the game doesn't exist. */
export async function getGameStats(gameId: string, nowMs = Date.now()): Promise<GameStats | null> {
  if (!(await getGame(gameId))) return null;
  const windows = weekWindows(nowMs);
  const since = windows[0]!.start;
  const agg = await aggregatePlays(gameId, since, windows);
  return {
    gameId,
    totalPlays: agg.totalPlays,
    averageScore: agg.averageScore,
    uniquePlayers: agg.uniquePlayers,
    weeklyBreakdown: windows.map((w, i) => ({
      start: w.start.toISOString(),
      end: w.end.toISOString(),
      label: weekLabel(w.start),
      count: agg.windowCounts[i] ?? 0,
    })),
    since: since.toISOString(),
  };
}
