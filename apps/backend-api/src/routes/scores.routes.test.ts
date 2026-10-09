import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { and, eq } from "drizzle-orm";
import { seedDatabase } from "../db/seedData.js";
import { startTestApp, type TestApp } from "../test/app.js";
import { bestScores, follows, plays, userGameStats, users } from "../db/schema.js";
import { localDayFor, localWeekFor } from "../services/streakRules.js";
import { DEFAULT_EXPERIENCE_LEVELS } from "../data/experienceLevels.js";

// Test games (src/test/db.ts): max 1000, 50 points/second; test-game ×1 active,
// beta-game ×2 beta, old-game inactive.

let api: TestApp;
beforeAll(async () => {
  api = await startTestApp();
});
afterAll(() => api.close());

const submit = (as: string, body: Record<string, unknown>) =>
  api.request("POST", "/scores", { as, body: { tzOffsetMinutes: 0, ...body } });

async function playsFor(userId: string, gameId: string) {
  return api.db
    .select()
    .from(plays)
    .where(and(eq(plays.userId, userId), eq(plays.gameId, gameId)));
}

async function statsFor(userId: string, gameId: string) {
  const [row] = await api.db
    .select()
    .from(userGameStats)
    .where(and(eq(userGameStats.userId, userId), eq(userGameStats.gameId, gameId)));
  return row;
}

async function bestFor(userId: string, gameId: string) {
  const [row] = await api.db
    .select()
    .from(bestScores)
    .where(and(eq(bestScores.userId, userId), eq(bestScores.gameId, gameId)));
  return row;
}

async function userRow(id: string) {
  const [row] = await api.db.select().from(users).where(eq(users.id, id));
  return row!;
}

describe("POST /scores", () => {
  test("a resend with the same play id is saved once (offline queue, T10.4)", async () => {
    await api.addUser({ id: "queue-kid" });
    await seedDatabase(api.db, [
      {
        id: "queue-game",
        title: "Queue",
        status: "active",
        scoring: { max: 1000, perSecondMax: 50, xpMultiplier: 1 },
      },
    ]);
    const playId = "3f2b8c1e-7a4d-4c6b-9e2f-1a2b3c4d5e6f";
    const body = { gameId: "queue-game", score: 40, durationMs: 10_000, playId };
    const first = await submit("queue-kid", body);
    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBeUndefined();
    const again = await submit("queue-kid", body);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({
      duplicate: true,
      newBest: false,
      xpAwarded: first.body.xpAwarded,
    });
    expect(await playsFor("queue-kid", "queue-game")).toHaveLength(1);
    expect((await statsFor("queue-kid", "queue-game"))?.plays).toBe(1);

    await api.addUser({ id: "someone-else" });
    const stolen = await submit("someone-else", body);
    expect(stolen.status).toBe(409);
  });

  test("a normal score saves the play, best, stats, XP and streak", async () => {
    await api.addUser({ id: "ann" });
    const res = await submit("ann", {
      gameId: "test-game",
      score: 100,
      durationMs: 10_000,
      xpMultiplier: 50, // ignored: the multiplier comes from the games row
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      gameId: "test-game",
      score: 100,
      awardedXp: 100,
      xpAwarded: 100,
      newBest: true,
      summary: { level: 1, progress: 100, total: 100 },
      streak: { currentStreak: 1, longestStreak: 1, extended: false },
    });
    expect(res.body.newLevel).toBeUndefined();
    expect(typeof res.body.createdAt).toBe("string");

    const [play] = await playsFor("ann", "test-game");
    expect(play).toMatchObject({ score: 100, durationMs: 10_000, xpAwarded: 100 });
    expect((await bestFor("ann", "test-game"))?.score).toBe(100);
    expect(await statsFor("ann", "test-game")).toMatchObject({
      plays: 1,
      bestScore: 100,
      lastScore: 100,
    });
    const ann = await userRow("ann");
    expect(ann).toMatchObject({ xpTotal: 100, xpLevel: 1, xpProgress: 100, streakCurrent: 1 });
    expect(ann.streakLastDay).toBe(localDayFor(Date.now(), 0));
  });

  test("a lower second score keeps the best and counts the play", async () => {
    const res = await submit("ann", { gameId: "test-game", score: 50 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ newBest: false, xpAwarded: 50, streak: { currentStreak: 1 } });
    expect((await bestFor("ann", "test-game"))?.score).toBe(100);
    expect(await statsFor("ann", "test-game")).toMatchObject({
      plays: 2,
      bestScore: 100,
      lastScore: 50,
    });
    expect(await playsFor("ann", "test-game")).toHaveLength(2);
    expect((await userRow("ann")).xpTotal).toBe(150);
  });

  test("XP uses the game's multiplier and reports a level up", async () => {
    await api.addUser({ id: "tess", betaTester: true });
    const res = await submit("tess", { gameId: "beta-game", score: 1000, durationMs: 30_000 });
    expect(res.status).toBe(200);
    const xp = 2000;
    const level1 = DEFAULT_EXPERIENCE_LEVELS[0]!.requiredXp;
    expect(res.body).toMatchObject({
      xpAwarded: xp,
      newLevel: 2,
      summary: { level: 2, progress: xp - level1, total: xp },
    });
    expect(await userRow("tess")).toMatchObject({ xpTotal: xp, xpLevel: 2 });
  });

  test("impossible scores are rejected with 400 and nothing is saved", async () => {
    await api.addUser({ id: "cheat" });
    const tooHigh = await submit("cheat", { gameId: "test-game", score: 5000 });
    expect(tooHigh).toEqual({ status: 400, body: { error: "score_too_high" } });
    const tooFast = await submit("cheat", { gameId: "test-game", score: 900, durationMs: 1000 });
    expect(tooFast).toEqual({ status: 400, body: { error: "score_too_fast" } });
    const notNumber = await submit("cheat", { gameId: "test-game", score: "90" });
    expect(notNumber).toEqual({ status: 400, body: { error: "score_invalid" } });
    expect(await playsFor("cheat", "test-game")).toHaveLength(0);
    expect(await userRow("cheat")).toMatchObject({ xpTotal: 0, streakCurrent: 0 });
  });

  test("inactive, beta-only and unknown games are rejected", async () => {
    await api.addUser({ id: "kid" });
    expect(await submit("kid", { gameId: "old-game", score: 10 })).toEqual({
      status: 400,
      body: { error: "game_inactive" },
    });
    expect(await submit("kid", { gameId: "beta-game", score: 10 })).toEqual({
      status: 403,
      body: { error: "game_beta_only" },
    });
    expect(await submit("kid", { gameId: "no-such-game", score: 10 })).toEqual({
      status: 404,
      body: { error: "game_not_found" },
    });
    expect(await submit("kid", { gameId: "../x", score: 10 })).toEqual({
      status: 400,
      body: { error: "gameId_invalid" },
    });
    expect(await playsFor("kid", "beta-game")).toHaveLength(0);
  });

  test("disabled accounts, missing profiles and signed-out requests cannot post", async () => {
    await api.addUser({ id: "banned", disabledAt: new Date() });
    expect(await submit("banned", { gameId: "test-game", score: 10 })).toEqual({
      status: 403,
      body: { error: "account_disabled" },
    });
    expect((await submit("ghost", { gameId: "test-game", score: 10 })).status).toBe(404);
    const anon = await api.request("POST", "/scores", { body: { gameId: "test-game", score: 1 } });
    expect(anon.status).toBe(401);
  });
});

describe("GET /scores/:gameId", () => {
  beforeAll(async () => {
    await api.addUser({ id: "lb-viewer", avatar: 3 });
    await api.addUser({ id: "lb-friend" });
    await api.addUser({ id: "lb-pending" });
    await api.addUser({ id: "lb-stranger" });
    await submit("lb-viewer", { gameId: "test-game", score: 200 });
    await submit("lb-friend", { gameId: "test-game", score: 300 });
    await submit("lb-pending", { gameId: "test-game", score: 300 });
    await submit("lb-stranger", { gameId: "test-game", score: 400 });
    await api.db.insert(follows).values([
      // Friends are accepted both ways (T7.6).
      { userId: "lb-viewer", targetUserId: "lb-friend", status: "accepted" },
      { userId: "lb-friend", targetUserId: "lb-viewer", status: "accepted" },
      { userId: "lb-viewer", targetUserId: "lb-pending", status: "pending" },
    ]);
    // A disabled player's best stays in the table but leaves the boards.
    await api.addUser({ id: "lb-disabled" });
    await submit("lb-disabled", { gameId: "test-game", score: 999, durationMs: 60_000 });
    await api.db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, "lb-disabled"));
  });

  test("best score per player, highest first, earlier wins a tie, public fields only", async () => {
    const res = await api.request("GET", "/scores/test-game?limit=50");
    expect(res.status).toBe(200);
    const rows = res.body as Array<Record<string, unknown>>;
    expect(rows.map((r) => [r.userId, r.score])).toEqual([
      ["lb-stranger", 400],
      ["lb-friend", 300],
      ["lb-pending", 300],
      ["lb-viewer", 200],
      ["ann", 100],
    ]);
    expect(Object.keys(rows[3]!).sort()).toEqual(
      ["avatar", "createdAt", "level", "score", "screenName", "userId"].sort(),
    );
    expect(rows[3]).toMatchObject({ screenName: "player-lb-viewer", avatar: 3, level: 1 });
  });

  test("limit is honoured", async () => {
    const res = await api.request("GET", "/scores/test-game?limit=2");
    expect((res.body as unknown[]).length).toBe(2);
  });

  test("following board is the viewer plus accepted follows, and needs sign-in", async () => {
    const res = await api.request("GET", "/scores/test-game?scope=following", { as: "lb-viewer" });
    expect(res.status).toBe(200);
    expect((res.body as Array<{ userId: string }>).map((r) => r.userId)).toEqual([
      "lb-friend",
      "lb-viewer",
    ]);
    expect((await api.request("GET", "/scores/test-game?scope=following")).status).toBe(401);
  });

  test("unknown games give an empty board", async () => {
    expect(await api.request("GET", "/scores/nothing-here")).toEqual({ status: 200, body: [] });
  });
});

describe("streak and experience", () => {
  test("check-in starts, holds and extends a streak", async () => {
    await api.addUser({ id: "streaky" });
    const first = await api.request("POST", "/users/streak/checkin", {
      as: "streaky",
      body: { tzOffsetMinutes: 0, todayDate: "2000-01-01" },
    });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ currentStreak: 1, longestStreak: 1, extended: false });
    expect(first.body.lastLoginDate).toBe(localDayFor(Date.now(), 0));

    const again = await api.request("POST", "/users/streak/checkin", {
      as: "streaky",
      body: { tzOffsetMinutes: 0 },
    });
    expect(again.body).toMatchObject({ currentStreak: 1, extended: false });

    const yesterday = localDayFor(Date.now() - 86_400_000, 0);
    await api.addUser({
      id: "regular",
      streakCurrent: 4,
      streakLongest: 4,
      streakLastDay: yesterday,
    });
    const next = await api.request("POST", "/users/streak/checkin", {
      as: "regular",
      body: { tzOffsetMinutes: 0 },
    });
    expect(next.body).toMatchObject({ currentStreak: 5, longestStreak: 5, extended: true });

    const read = await api.request("GET", "/users/streak", { as: "regular" });
    expect(read).toEqual({
      status: 200,
      body: { currentStreak: 5, longestStreak: 5, lastLoginDate: localDayFor(Date.now(), 0) },
    });
    expect((await api.request("POST", "/users/streak/checkin", { as: "nobody" })).status).toBe(404);
  });

  test("experience summary reads the user row", async () => {
    const res = await api.request("GET", "/experience/summary", { as: "ann" });
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      level: 1,
      progress: 150,
      total: 150,
      required: DEFAULT_EXPERIENCE_LEVELS[0]!.requiredXp,
    });
    expect(await api.request("GET", "/experience/summary", { as: "nobody" })).toEqual({
      status: 200,
      body: { summary: null },
    });
    expect((await api.request("GET", "/experience/summary")).status).toBe(401);
  });
});

describe("weekly stickers", () => {
  /** Noon (player time) on days of this local week other than today. */
  function otherDaysThisWeek(tzOffsetMinutes: number, count: number): Date[] {
    const week = localWeekFor(Date.now(), tzOffsetMinutes);
    const days: Date[] = [];
    for (let i = 0; i < 7 && days.length < count; i++) {
      const at = week.startMs + i * 86_400_000 + 12 * 3_600_000;
      if (localDayFor(at, tzOffsetMinutes) !== week.today) days.push(new Date(at));
    }
    return days;
  }

  /** The weekly sticker in a POST /scores answer (achievement stickers may come too, T11.4). */
  const weekly = (body: { stickersEarned?: Array<{ kind: string }> }) =>
    body.stickersEarned?.find((s) => s.kind === "weekly");

  async function addPlays(userId: string, when: Date[]) {
    for (const createdAt of when) {
      await api.db.insert(plays).values({ userId, gameId: "test-game", score: 10, createdAt });
    }
  }

  test("the third different day this week collects the sticker, once", async () => {
    await api.addUser({ id: "sticky" });
    await addPlays("sticky", otherDaysThisWeek(0, 2));
    const week = localWeekFor(Date.now(), 0);

    const first = await submit("sticky", { gameId: "test-game", score: 20 });
    expect(first.status).toBe(200);
    expect(first.body.stickerEarned).toEqual({ id: week.stickerId, kind: "weekly" });
    expect(weekly(first.body)).toEqual({ id: week.stickerId, kind: "weekly" });

    const again = await submit("sticky", { gameId: "test-game", score: 30 });
    expect(again.status).toBe(200);
    expect(weekly(again.body)).toBeUndefined();

    const list = await api.request("GET", "/users/stickers", { as: "sticky" });
    expect(list.status).toBe(200);
    const weeklies = list.body.stickers.filter((s: { id: string }) => s.id.startsWith("week-"));
    expect(weeklies).toHaveLength(1);
    expect(weeklies[0]).toMatchObject({ id: week.stickerId });
    expect(typeof weeklies[0].earnedAt).toBe("string");
  });

  test("two days, or many plays on one day, are not enough", async () => {
    await api.addUser({ id: "twice" });
    await addPlays("twice", otherDaysThisWeek(0, 1));
    const a = await submit("twice", { gameId: "test-game", score: 20 });
    const b = await submit("twice", { gameId: "test-game", score: 25 });
    expect(weekly(a.body)).toBeUndefined();
    expect(weekly(b.body)).toBeUndefined();
    const list = await api.request("GET", "/users/stickers", { as: "twice" });
    expect(list.body.stickers.filter((s: { id: string }) => s.id.startsWith("week-"))).toEqual([]);
  });

  test("days are counted in the player's own time zone", async () => {
    await api.addUser({ id: "sydney" });
    await addPlays("sydney", otherDaysThisWeek(660, 2));
    const res = await submit("sydney", { gameId: "test-game", score: 20, tzOffsetMinutes: 660 });
    expect(weekly(res.body)).toEqual({
      id: localWeekFor(Date.now(), 660).stickerId,
      kind: "weekly",
    });
  });

  test("plays from last week do not count", async () => {
    await api.addUser({ id: "lastweek" });
    const start = localWeekFor(Date.now(), 0).startMs;
    await addPlays("lastweek", [new Date(start - 86_400_000), new Date(start - 2 * 86_400_000)]);
    const res = await submit("lastweek", { gameId: "test-game", score: 20 });
    expect(weekly(res.body)).toBeUndefined();
  });

  test("the sticker list needs sign-in", async () => {
    expect((await api.request("GET", "/users/stickers")).status).toBe(401);
  });
});
