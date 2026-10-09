import type { Db } from "../db/client.js";
import {
  getDailyRun,
  insertDailyRun,
  listActiveGameIds,
  listDailyBoard,
  type DailyBoardRow,
} from "../repos/dailyRepo.js";
import { dailyGameFor, dailySeedFor } from "./dailyRules.js";
import { clampTzOffset, localDayFor } from "./streakRules.js";

/** Rows on the daily board. */
export const DAILY_BOARD_SIZE = 20;

export type DailyChallenge = {
  /** The player's local day (YYYY-MM-DD); the board resets at their midnight. */
  day: string;
  /** Today's game, or null when no game is active. */
  gameId: string | null;
  /** The seed host.rng() uses for today's run. */
  seed: number;
  /** The signed-in player's counted run today. */
  myRun?: { score: number };
  board: DailyBoardRow[];
};

/**
 * GET /daily. The day comes from the server clock plus the player's clamped
 * UTC offset, never from the client.
 */
export async function getDailyChallenge(
  viewerId: string | undefined,
  tzOffsetMinutes: unknown,
  nowMs: number = Date.now(),
): Promise<DailyChallenge> {
  const day = localDayFor(nowMs, clampTzOffset(tzOffsetMinutes));
  const [gameIds, board, mine] = await Promise.all([
    listActiveGameIds(),
    listDailyBoard(day, DAILY_BOARD_SIZE, viewerId),
    viewerId ? getDailyRun(viewerId, day) : Promise.resolve(null),
  ]);
  return {
    day,
    gameId: dailyGameFor(day, gameIds),
    seed: dailySeedFor(day),
    ...(mine ? { myRun: { score: mine.score } } : {}),
    board,
  };
}

export type DailyRunResult = {
  day: string;
  /** True when this run is the player's scored daily run for the day. */
  counted: boolean;
};

/**
 * Inside the score transaction, after the play is inserted: the first run of
 * today's game sent with `daily: true` becomes the day's daily run. A different
 * game, or a later run, is just a normal play.
 */
export async function recordDailyRun(
  tx: Db,
  run: {
    userId: string;
    gameId: string;
    score: number;
    playId: string;
    tzOffsetMinutes: unknown;
    nowMs: number;
  },
): Promise<DailyRunResult> {
  const day = localDayFor(run.nowMs, clampTzOffset(run.tzOffsetMinutes));
  if (dailyGameFor(day, await listActiveGameIds(tx)) !== run.gameId) {
    return { day, counted: false };
  }
  const counted = await insertDailyRun(tx, {
    userId: run.userId,
    day,
    gameId: run.gameId,
    score: run.score,
    playId: run.playId,
  });
  return { day, counted };
}
