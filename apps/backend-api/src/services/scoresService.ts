import { getDb } from "../db/client.js";
import {
  getGameById,
  getPlayById,
  insertPlay,
  listLeaderboard,
  upsertBestScore,
} from "../repos/playsRepo.js";
import { lockUser, recordGamePlay, updateUserProgress } from "../repos/statsRepo.js";
import {
  ScoreRejected,
  assertCanSubmit,
  isValidGameId,
  limitsFor,
  multiplierFor,
  validateScoreSubmission,
  xpForScore,
} from "./scoringRules.js";
import {
  addExperience,
  buildSummary,
  loadExperienceLevels,
  type ExperienceSummary,
} from "./experienceService.js";
import { applyDailyStreak, streakOf, type StreakResult } from "./streakService.js";
import { awardRunStickers, type StickerEarned } from "./achievements.js";
import { recordDailyRun, type DailyRunResult } from "./dailyService.js";
import { remixForRun } from "./remixService.js";
import { bestOnRemix } from "../repos/remixesRepo.js";

export interface PublicScoreRow {
  userId?: string;
  screenName: string;
  avatar: number;
  score: number;
  createdAt: string;
  level?: number | null;
}

export type ScoreSubmission = {
  gameId: string;
  score: number;
  createdAt: string;
  xpAwarded: number;
  newBest: boolean;
  /** Only when this run levelled the player up. */
  newLevel?: number;
  summary: ExperienceSummary;
  streak: StreakResult["streak"] & { extended: boolean; isNewStreak: boolean };
  /** The first sticker this run collected (kept for older apps; T7.5). */
  stickerEarned?: StickerEarned;
  /** Every sticker this run collected, the weekly one first (T11.4). */
  stickersEarned?: StickerEarned[];
  /** Only when the run was sent as a daily-challenge run (T11.3). */
  daily?: DailyRunResult;
  /** The saved play (share links, T11.5). */
  playId: string;
  /** True when this play id was already saved (an offline-queue resend). */
  duplicate?: true;
};

/**
 * Saves one run in a single transaction: check the game and the player, validate
 * the score against the game's own limits, insert the play, raise the best score,
 * add XP (score × the game's multiplier from the database), count today's streak,
 * save a daily-challenge run, collect stickers and update the per-game stats. Throws ScoreRejected for anything refused.
 */
export async function submitScore(
  userId: string,
  body: {
    gameId?: unknown;
    score?: unknown;
    durationMs?: unknown;
    tzOffsetMinutes?: unknown;
    playId?: unknown;
    daily?: unknown;
    /** A saved remix (T11.2): checked here, and the run goes on that remix's board. */
    remixId?: unknown;
  },
  nowMs: number = Date.now(),
): Promise<ScoreSubmission> {
  if (!isValidGameId(body.gameId)) throw new ScoreRejected("gameId_invalid");
  const gameId = body.gameId;
  // Loaded before the transaction: the Lambda has a single connection.
  const levels = await loadExperienceLevels();

  return getDb().transaction(async (tx) => {
    const game = await getGameById(gameId, tx);
    const user = await lockUser(tx, userId);
    const player = assertCanSubmit(game, user);

    // A resend from the offline queue (T10.4): same id, already saved → answer
    // without counting it twice.
    const playId = parsePlayId(body.playId);
    if (playId) {
      const earlier = await getPlayById(tx, playId);
      if (earlier) {
        if (earlier.userId !== userId || earlier.gameId !== gameId) {
          throw new ScoreRejected("play_id_conflict", 409);
        }
        return {
          gameId,
          score: earlier.score,
          playId: earlier.id,
          createdAt: earlier.createdAt.toISOString(),
          xpAwarded: earlier.xpAwarded,
          newBest: false,
          summary: buildSummary(player),
          streak: { ...streakOf(player), extended: false, isNewStreak: false },
          duplicate: true,
        };
      }
    }

    const valid = validateScoreSubmission(body, limitsFor(game));
    // A remix run (T11.2) earns XP and counts for the streak, but has its own board:
    // it never raises the game's best (an easy remix mustn't top the normal board).
    const remixId = await remixForRun(tx, body.remixId, gameId);
    const remixBestBefore = remixId ? await bestOnRemix(tx, userId, remixId) : 0;

    const xpAwarded = xpForScore(valid.score, multiplierFor(game));
    const now = new Date(nowMs);
    const play = await insertPlay(tx, {
      ...(playId ? { id: playId } : {}),
      userId,
      gameId,
      score: valid.score,
      durationMs: valid.durationMs ?? null,
      xpAwarded,
      remixId,
    });
    const best = remixId
      ? null
      : await upsertBestScore(tx, {
          userId,
          gameId,
          score: valid.score,
          playId: play.id,
          achievedAt: play.createdAt,
        });

    const xp = addExperience(
      levels,
      { level: player.xpLevel, progress: player.xpProgress, total: player.xpTotal },
      xpAwarded,
    );
    const updated =
      xpAwarded > 0
        ? await updateUserProgress(tx, userId, {
            xpLevel: xp.level,
            xpProgress: xp.progress,
            xpTotal: xp.total,
          })
        : player;

    const streak = await applyDailyStreak(tx, player, body.tzOffsetMinutes, nowMs);
    // A remix run is never the daily run: its knobs could make the game easier.
    const daily =
      body.daily === true && !remixId
        ? await recordDailyRun(tx, {
            userId,
            gameId,
            score: valid.score,
            playId: play.id,
            tzOffsetMinutes: body.tzOffsetMinutes,
            nowMs,
          })
        : undefined;
    const stickers = await awardRunStickers(tx, {
      userId,
      gameId,
      score: valid.score,
      newBest: best !== null,
      onRemix: Boolean(remixId),
      tzOffsetMinutes: body.tzOffsetMinutes,
      nowMs,
    });
    await recordGamePlay(tx, { userId, gameId, score: valid.score, playedAt: now });

    return {
      gameId,
      score: valid.score,
      playId: play.id,
      createdAt: play.createdAt.toISOString(),
      xpAwarded,
      // On a remix: the player's best on that remix.
      newBest: remixId ? valid.score > remixBestBefore : best !== null,
      ...(xp.level > player.xpLevel ? { newLevel: xp.level } : {}),
      summary: buildSummary(updated ?? player),
      streak: { ...streak.streak, extended: streak.extended, isNewStreak: streak.isNewStreak },
      ...(stickers[0] ? { stickerEarned: stickers[0] } : {}),
      stickersEarned: stickers,
      ...(daily ? { daily } : {}),
    };
  });
}

/**
 * The leaderboard for a game from best_scores: one row per player, highest
 * first, public fields only. `friendsOf` limits it to that player and the
 * players they follow.
 */
export async function getLeaderboard(
  gameId: string,
  limit: number,
  opts: { friendsOf?: string } = {},
): Promise<PublicScoreRow[]> {
  const rows = await listLeaderboard(gameId, limit, opts);
  return rows.map((r) => ({
    userId: r.userId,
    screenName: r.screenName,
    avatar: r.avatar,
    score: r.score,
    createdAt: r.achievedAt.toISOString(),
    level: r.level,
  }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A client-generated play id (a v4-style UUID), or null when absent or malformed. */
function parsePlayId(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}
