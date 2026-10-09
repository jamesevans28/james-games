/**
 * Stickers (T7.5, T11.4). The rules are a declarative list; the server is the
 * authority and awards them inside the score transaction (or when a friendship
 * is accepted). The player app has only the catalogue (art, label, hint) in
 * apps/player-web/src/config/stickers.ts, keyed by the same ids; a test checks
 * that every id here is in it.
 */
import { getDb, type Db } from "../db/client.js";
import { countDailyRunsBetween } from "../repos/dailyRepo.js";
import { listLocalPlayDays } from "../repos/statsRepo.js";
import { awardSticker, countPlaysFor, listStickerIds } from "../repos/stickersRepo.js";
import { log } from "../lib/log.js";
import { isoWeekBounds } from "./dailyRules.js";
import { localWeekFor, weeklyStickerId } from "./streakRules.js";

export type AchievementRule =
  /** The very first saved run. */
  | { id: string; kind: "first-play" }
  /** A run that beats the player's own earlier best in a game. */
  | { id: string; kind: "beat-best" }
  /** Runs saved in this many different games. */
  | { id: string; kind: "games-tried"; count: number }
  /**
   * Plays on this many different days in one ISO week. Collectable every week:
   * the stored id is `week-<isoYear>-<isoWeek>` (T7.5), not the rule id.
   */
  | { id: string; kind: "week-days"; days: number }
  /** This many daily-challenge runs in one ISO week (T11.3). */
  | { id: string; kind: "dailies-week"; count: number }
  /** A score of at least `atLeast` in one game. */
  | { id: string; kind: "score"; gameId: string; atLeast: number }
  /** A friend request accepted (either side). */
  | { id: string; kind: "friend" }
  /** Given by a grown-up (admin), never by a rule. */
  | { id: string; kind: "manual" };

export const ACHIEVEMENT_RULES: readonly AchievementRule[] = [
  { id: "week", kind: "week-days", days: 3 },
  { id: "first-play", kind: "first-play" },
  { id: "beat-best", kind: "beat-best" },
  { id: "five-games", kind: "games-tried", count: 5 },
  { id: "daily-trio", kind: "dailies-week", count: 3 },
  { id: "reflex-ring-100", kind: "score", gameId: "reflex-ring", atLeast: 100 },
  { id: "serpento-20", kind: "score", gameId: "serpento", atLeast: 20 },
  { id: "snapadile-50", kind: "score", gameId: "snapadile", atLeast: 50 },
  { id: "hoop-city-50", kind: "score", gameId: "hoop-city", atLeast: 50 },
  { id: "friend-made", kind: "friend" },
  { id: "supporter", kind: "manual" },
];

export type StickerEarned = { id: string; kind: "weekly" | "achievement" };

/** What one saved run tells the rules. Counts include this run. */
export type RunFacts = {
  gameId: string;
  score: number;
  /** The player's local day for this run (YYYY-MM-DD). */
  today: string;
  totalPlays: number;
  gamesTried: number;
  /** True when this run raised a best that already existed. */
  beatBest: boolean;
  /** Local days with plays in this run's ISO week (today may be missing; it counts anyway). */
  weekPlayDays: readonly string[];
  /** Daily runs saved in this run's ISO week. */
  dailiesThisWeek: number;
  /** Played on a remix (T11.2): score stickers need the normal game. */
  onRemix?: boolean;
};

function earnedForRun(rule: AchievementRule, f: RunFacts): string | null {
  switch (rule.kind) {
    case "first-play":
      return f.totalPlays === 1 ? rule.id : null;
    case "beat-best":
      return f.beatBest ? rule.id : null;
    case "games-tried":
      return f.gamesTried >= rule.count ? rule.id : null;
    case "week-days": {
      const week = weeklyStickerId(f.today);
      const days = new Set([...f.weekPlayDays, f.today].filter((d) => weeklyStickerId(d) === week));
      return days.size >= rule.days ? week : null;
    }
    case "dailies-week":
      return f.dailiesThisWeek >= rule.count ? rule.id : null;
    case "score":
      return !f.onRemix && f.gameId === rule.gameId && f.score >= rule.atLeast ? rule.id : null;
    case "friend":
    case "manual":
      return null;
  }
}

const kindOf = (rule: AchievementRule): StickerEarned["kind"] =>
  rule.kind === "week-days" ? "weekly" : "achievement";

/**
 * The stickers a run collects: every rule it meets whose sticker the player
 * doesn't have yet, in rule order (the weekly sticker first).
 */
export function stickersForRun(
  facts: RunFacts,
  owned: ReadonlySet<string>,
  rules: readonly AchievementRule[] = ACHIEVEMENT_RULES,
): StickerEarned[] {
  const out: StickerEarned[] = [];
  for (const rule of rules) {
    const id = earnedForRun(rule, facts);
    if (id && !owned.has(id) && !out.some((s) => s.id === id)) {
      out.push({ id, kind: kindOf(rule) });
    }
  }
  return out;
}

/** The stickers a new friendship collects for one of the two players. */
export function stickersForFriendship(
  owned: ReadonlySet<string>,
  rules: readonly AchievementRule[] = ACHIEVEMENT_RULES,
): StickerEarned[] {
  return rules
    .filter((r) => r.kind === "friend" && !owned.has(r.id))
    .map((r) => ({ id: r.id, kind: "achievement" as const }));
}

/**
 * Inside the score transaction, after the play, best score and any daily run
 * are saved: works out the facts, runs the rules and stores what was collected
 * (idempotent). Returns only the stickers this call collected.
 */
export async function awardRunStickers(
  tx: Db,
  run: {
    userId: string;
    gameId: string;
    score: number;
    newBest: boolean;
    onRemix?: boolean;
    tzOffsetMinutes: unknown;
    nowMs: number;
  },
): Promise<StickerEarned[]> {
  const week = localWeekFor(run.nowMs, run.tzOffsetMinutes);
  const { monday, sunday } = isoWeekBounds(week.today);
  // One after another: a transaction is one connection.
  const owned = await listStickerIds(tx, run.userId);
  const counts = await countPlaysFor(tx, run.userId, run.gameId);
  const weekPlayDays = await listLocalPlayDays(tx, run.userId, week);
  const dailiesThisWeek = await countDailyRunsBetween(tx, run.userId, monday, sunday);
  const earned = stickersForRun(
    {
      gameId: run.gameId,
      score: run.score,
      today: week.today,
      totalPlays: counts.total,
      gamesTried: counts.games,
      beatBest: run.newBest && counts.thisGame > 1,
      weekPlayDays,
      dailiesThisWeek,
      onRemix: run.onRemix,
    },
    owned,
  );
  return collect(tx, run.userId, earned, new Date(run.nowMs));
}

async function collect(
  db: Db,
  userId: string,
  earned: StickerEarned[],
  earnedAt: Date,
): Promise<StickerEarned[]> {
  const collected: StickerEarned[] = [];
  for (const sticker of earned) {
    if (await awardSticker(db, { userId, stickerId: sticker.id, earnedAt })) {
      collected.push(sticker);
    }
  }
  return collected;
}

/**
 * A friendship was accepted: both players collect the friend sticker if they
 * don't have it. Never fails the accept; a problem is logged without ids.
 */
export async function awardFriendStickers(userId: string, otherId: string): Promise<void> {
  try {
    const db = getDb();
    const now = new Date();
    for (const id of [userId, otherId]) {
      await collect(db, id, stickersForFriendship(await listStickerIds(db, id)), now);
    }
  } catch (e) {
    log.warn("friend_sticker_failed", {}, e);
  }
}
