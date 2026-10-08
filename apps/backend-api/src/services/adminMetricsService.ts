/**
 * Admin dashboard (T6.8): a handful of SQL aggregates, no table scans in code.
 * "7d" figures are a rolling 7 days; `daily` is the last 14 UTC days, oldest first.
 */
import {
  liveGameCount,
  newUsersPerDay,
  playActivity,
  playsPerDay,
  topGamesByPlays,
  userTotals,
} from "../repos/adminRepo.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_DAYS = 14;
const TOP_GAMES = 5;

export type DailyMetric = { day: string; plays: number; activeUsers: number; newUsers: number };

export type DashboardMetrics = {
  timeframe: { since: string; days: number };
  totals: {
    users: number;
    betaTesters: number;
    admins: number;
    disabled: number;
    newUsers7d: number;
    gamesLive: number;
  };
  activity: {
    activeUsers7d: number;
    totalPlays7d: number;
    avgScore7d: number;
  };
  daily: DailyMetric[];
  topGames: Array<{
    gameId: string;
    title: string;
    thumbnail: string | null;
    plays7d: number;
    share: number;
  }>;
  recommendations: string[];
};

/** The last `n` UTC calendar days ending with `now`'s day, as YYYY-MM-DD, oldest first. */
export function lastUtcDays(now: Date, n: number): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: n }, (_, i) =>
    new Date(today - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10),
  );
}

function thumbnailOf(metadata: Record<string, unknown> | null): string | null {
  const value = metadata?.thumbnail;
  return typeof value === "string" ? value : null;
}

export async function getDashboardMetrics(now: Date = new Date()): Promise<DashboardMetrics> {
  const since7d = new Date(now.getTime() - 7 * DAY_MS);
  const days = lastUtcDays(now, DAILY_DAYS);
  const dailySince = new Date(`${days[0]}T00:00:00.000Z`);

  const [users, gamesLive, activity, dailyPlays, dailyUsers, top] = await Promise.all([
    userTotals(since7d),
    liveGameCount(),
    playActivity(since7d),
    playsPerDay(dailySince),
    newUsersPerDay(dailySince),
    topGamesByPlays(since7d, TOP_GAMES),
  ]);

  const playsByDay = new Map(dailyPlays.map((d) => [d.day, d]));
  const usersByDay = new Map(dailyUsers.map((d) => [d.day, d.newUsers]));
  const daily = days.map((day) => ({
    day,
    plays: playsByDay.get(day)?.plays ?? 0,
    activeUsers: playsByDay.get(day)?.activeUsers ?? 0,
    newUsers: usersByDay.get(day) ?? 0,
  }));

  const totalPlays7d = activity.plays;
  const topGames = top.map((g) => ({
    gameId: g.gameId,
    title: g.title,
    thumbnail: thumbnailOf(g.metadata),
    plays7d: g.plays,
    share: totalPlays7d ? Number((g.plays / totalPlays7d).toFixed(3)) : 0,
  }));

  const totals = {
    users: users.users,
    betaTesters: users.betaTesters,
    admins: users.admins,
    disabled: users.disabled,
    newUsers7d: users.newUsers,
    gamesLive,
  };

  return {
    timeframe: { since: since7d.toISOString(), days: 7 },
    totals,
    activity: {
      activeUsers7d: activity.activeUsers,
      totalPlays7d,
      avgScore7d: Number(Number(activity.avgScore).toFixed(2)),
    },
    daily,
    topGames,
    recommendations: buildRecommendations(totals, activity.activeUsers, topGames),
  };
}

function buildRecommendations(
  totals: { users: number; betaTesters: number },
  activeUsers: number,
  topGames: Array<{ title: string; share: number }>,
) {
  const recs: string[] = [];
  const leader = topGames[0];
  if (leader && leader.share > 0.4) {
    recs.push(
      `${leader.title} accounts for ${(leader.share * 100).toFixed(1)}% of weekly plays — consider featuring another game to balance engagement.`,
    );
  }
  if (activeUsers < Math.max(10, Math.round(totals.users * 0.1))) {
    recs.push("Active players are low versus total accounts — consider a new game drop or event.");
  }
  if (totals.betaTesters / Math.max(totals.users, 1) < 0.05) {
    recs.push("Recruit more beta testers to keep early feedback flowing.");
  }
  if (!recs.length) {
    recs.push("Engagement is healthy. Plan the next game drop to maintain momentum.");
  }
  return recs;
}
