/**
 * Data access for the admin console (T6.3, T6.8): user search, per-user stats,
 * moderation writes and dashboard aggregates. Pure queries; the rules live in
 * services/adminUserService.ts and services/adminMetricsService.ts.
 *
 * Functions that take `db` can run inside a transaction (`getDb().transaction(tx => …)`).
 */
import { and, asc, count, desc, eq, gte, ilike, ne, or, sql } from "drizzle-orm";
import { getDb, type Db } from "../db/client.js";
import {
  bestScores,
  games,
  plays,
  screenNameHistory,
  userGameStats,
  users,
  type Play,
  type User,
} from "../db/schema.js";

/** Escapes LIKE wildcards so a search for "a_b" matches literally. */
function likeContains(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Users newest first. `search` matches screen name or username (case-insensitive,
 * substring) or an exact user id. Returns up to `limit + 1` rows so the caller
 * can tell whether there is a next page.
 */
export async function listUsersPage(opts: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<User[]> {
  const term = opts.search?.trim();
  const where = term
    ? or(
        ilike(users.screenName, likeContains(term)),
        ilike(users.username, likeContains(term)),
        eq(users.id, term),
      )
    : undefined;
  return getDb()
    .select()
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(opts.limit + 1)
    .offset(opts.offset);
}

export async function listUserGameStats(userId: string) {
  return getDb()
    .select({
      gameId: userGameStats.gameId,
      title: games.title,
      plays: userGameStats.plays,
      bestScore: userGameStats.bestScore,
      lastScore: userGameStats.lastScore,
      lastPlayedAt: userGameStats.lastPlayedAt,
    })
    .from(userGameStats)
    .innerJoin(games, eq(games.id, userGameStats.gameId))
    .where(eq(userGameStats.userId, userId))
    .orderBy(desc(userGameStats.lastPlayedAt));
}

export async function listRecentPlays(userId: string, limit: number) {
  return getDb()
    .select({
      playId: plays.id,
      gameId: plays.gameId,
      title: games.title,
      score: plays.score,
      durationMs: plays.durationMs,
      xpAwarded: plays.xpAwarded,
      createdAt: plays.createdAt,
    })
    .from(plays)
    .innerJoin(games, eq(games.id, plays.gameId))
    .where(eq(plays.userId, userId))
    .orderBy(desc(plays.createdAt))
    .limit(limit);
}

export async function setDisabledAt(userId: string, disabledAt: Date | null): Promise<User | null> {
  const [row] = await getDb()
    .update(users)
    .set({ disabledAt, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return row ?? null;
}

export async function deletePlayRow(db: Db, playId: string): Promise<Play | null> {
  const [row] = await db.delete(plays).where(eq(plays.id, playId)).returning();
  return row ?? null;
}

/** The player's best remaining play for a game (earliest wins a tie), or null. */
export async function bestPlayFor(db: Db, userId: string, gameId: string): Promise<Play | null> {
  const [row] = await db
    .select()
    .from(plays)
    .where(and(eq(plays.userId, userId), eq(plays.gameId, gameId)))
    .orderBy(desc(plays.score), asc(plays.createdAt))
    .limit(1);
  return row ?? null;
}

export async function latestPlayFor(db: Db, userId: string, gameId: string): Promise<Play | null> {
  const [row] = await db
    .select()
    .from(plays)
    .where(and(eq(plays.userId, userId), eq(plays.gameId, gameId)))
    .orderBy(desc(plays.createdAt))
    .limit(1);
  return row ?? null;
}

export async function putBestScore(db: Db, best: Play & { userId: string }) {
  await db
    .insert(bestScores)
    .values({
      userId: best.userId,
      gameId: best.gameId,
      score: best.score,
      playId: best.id,
      achievedAt: best.createdAt,
    })
    .onConflictDoUpdate({
      target: [bestScores.userId, bestScores.gameId],
      set: { score: best.score, playId: best.id, achievedAt: best.createdAt },
    });
}

export async function deleteBestScore(db: Db, userId: string, gameId: string) {
  await db
    .delete(bestScores)
    .where(and(eq(bestScores.userId, userId), eq(bestScores.gameId, gameId)));
}

/** After a play is removed: one fewer play, best and last from what remains. */
export async function updateStatsAfterRemoval(
  db: Db,
  userId: string,
  gameId: string,
  remaining: { best: Play; latest: Play },
) {
  await db
    .update(userGameStats)
    .set({
      plays: sql`greatest(${userGameStats.plays} - 1, 0)`,
      bestScore: remaining.best.score,
      lastScore: remaining.latest.score,
      lastPlayedAt: remaining.latest.createdAt,
    })
    .where(and(eq(userGameStats.userId, userId), eq(userGameStats.gameId, gameId)));
}

export async function deleteStats(db: Db, userId: string, gameId: string) {
  await db
    .delete(userGameStats)
    .where(and(eq(userGameStats.userId, userId), eq(userGameStats.gameId, gameId)));
}

// ---- Dashboard aggregates ----

export async function userTotals(since: Date) {
  const [row] = await getDb()
    .select({
      users: count(),
      betaTesters: sql<number>`count(*) filter (where ${users.betaTester})::int`,
      admins: sql<number>`count(*) filter (where ${users.admin})::int`,
      disabled: sql<number>`count(*) filter (where ${users.disabledAt} is not null)::int`,
      newUsers: sql<number>`count(*) filter (where ${users.createdAt} >= ${since.toISOString()}::timestamptz)::int`,
    })
    .from(users);
  return row ?? { users: 0, betaTesters: 0, admins: 0, disabled: 0, newUsers: 0 };
}

export async function liveGameCount() {
  const [row] = await getDb()
    .select({ n: count() })
    .from(games)
    .where(ne(games.status, "inactive"));
  return row?.n ?? 0;
}

export async function playActivity(since: Date) {
  const [row] = await getDb()
    .select({
      plays: count(),
      activeUsers: sql<number>`count(distinct ${plays.userId})::int`,
      avgScore: sql<number>`coalesce(avg(${plays.score}), 0)::float8`,
    })
    .from(plays)
    .where(gte(plays.createdAt, since));
  return row ?? { plays: 0, activeUsers: 0, avgScore: 0 };
}

const playDay = sql<string>`to_char(${plays.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
const userDay = sql<string>`to_char(${users.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;

/** Plays and distinct players per UTC day since `since` (days with no plays are absent). */
export async function playsPerDay(since: Date) {
  return getDb()
    .select({
      day: playDay,
      plays: count(),
      activeUsers: sql<number>`count(distinct ${plays.userId})::int`,
    })
    .from(plays)
    .where(gte(plays.createdAt, since))
    .groupBy(playDay);
}

/** Sign-ups per UTC day since `since` (days with none are absent). */
export async function newUsersPerDay(since: Date) {
  return getDb()
    .select({ day: userDay, newUsers: count() })
    .from(users)
    .where(gte(users.createdAt, since))
    .groupBy(userDay);
}

export async function topGamesByPlays(since: Date, limit: number) {
  const plays7d = count(plays.id);
  return getDb()
    .select({ gameId: games.id, title: games.title, metadata: games.metadata, plays: plays7d })
    .from(plays)
    .innerJoin(games, eq(games.id, plays.gameId))
    .where(gte(plays.createdAt, since))
    .groupBy(games.id)
    .orderBy(desc(plays7d), asc(games.id))
    .limit(limit);
}

/** The latest screen-name changes, newest first, with the player's current name. */
export async function listRecentNameChanges(limit: number) {
  return getDb()
    .select({
      userId: screenNameHistory.userId,
      oldName: screenNameHistory.oldName,
      newName: screenNameHistory.newName,
      changedAt: screenNameHistory.changedAt,
      currentName: users.screenName,
    })
    .from(screenNameHistory)
    .innerJoin(users, eq(users.id, screenNameHistory.userId))
    .orderBy(desc(screenNameHistory.changedAt))
    .limit(limit);
}
