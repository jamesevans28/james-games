import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { and, eq } from "drizzle-orm";
import { startTestApp, type TestApp } from "../test/app.js";
import { blocks, dailyRuns, userStickers, users } from "../db/schema.js";
import { dailySeedFor, isoWeekBounds } from "../services/dailyRules.js";
import { localDayFor } from "../services/streakRules.js";

// Test games (src/test/db.ts): test-game is the only active game, so it is
// every day's challenge; beta-game is beta and old-game inactive.

let api: TestApp;
beforeAll(async () => {
  api = await startTestApp();
});
afterAll(() => api.close());

const submit = (as: string, body: Record<string, unknown>) =>
  api.request("POST", "/scores", { as, body: { tzOffsetMinutes: 0, ...body } });

const daily = (as?: string, tz = 0) => api.request("GET", `/daily?tz=${tz}`, as ? { as } : {});

async function stickerIds(userId: string): Promise<string[]> {
  const rows = await api.db
    .select({ id: userStickers.stickerId })
    .from(userStickers)
    .where(eq(userStickers.userId, userId));
  return rows.map((r) => r.id).sort();
}

describe("GET /daily (T11.3)", () => {
  test("two players get the same day, game and seed", async () => {
    await api.addUser({ id: "tilly" });
    await api.addUser({ id: "harvey" });
    const a = await daily("tilly");
    const b = await daily("harvey");
    const guest = await daily();
    expect(a.status).toBe(200);
    const today = localDayFor(Date.now(), 0);
    const expected = { day: today, gameId: "test-game", seed: dailySeedFor(today) };
    expect(a.body).toMatchObject(expected);
    expect(b.body).toMatchObject(expected);
    expect(guest.body).toMatchObject(expected);
    expect(a.body.myRun).toBeUndefined();
  });

  test("the day is the player's local day", async () => {
    const east = await daily(undefined, 14 * 60);
    const west = await daily(undefined, -12 * 60);
    expect(east.body.day).toBe(localDayFor(Date.now(), 14 * 60));
    expect(west.body.day).toBe(localDayFor(Date.now(), -12 * 60));
    expect(east.body.day).not.toBe(west.body.day);
    expect(east.body.seed).toBe(dailySeedFor(east.body.day));
  });
});

describe("daily runs through POST /scores", () => {
  test("the first daily run of the day counts; later ones are normal plays", async () => {
    await api.addUser({ id: "first" });
    const today = localDayFor(Date.now(), 0);
    const one = await submit("first", { gameId: "test-game", score: 40, daily: true });
    expect(one.status).toBe(200);
    expect(one.body.daily).toEqual({ day: today, counted: true });
    const two = await submit("first", { gameId: "test-game", score: 90, daily: true });
    expect(two.body.daily).toEqual({ day: today, counted: false });

    const [run] = await api.db.select().from(dailyRuns).where(eq(dailyRuns.userId, "first"));
    expect(run).toMatchObject({ day: today, gameId: "test-game", score: 40 });

    const mine = await daily("first");
    expect(mine.body.myRun).toEqual({ score: 40 });
  });

  test("without daily: true, or on another game, nothing is recorded", async () => {
    await api.addUser({ id: "normal", betaTester: true });
    const plain = await submit("normal", { gameId: "test-game", score: 40 });
    expect(plain.body.daily).toBeUndefined();
    const other = await submit("normal", { gameId: "beta-game", score: 40, daily: true });
    expect(other.body.daily).toMatchObject({ counted: false });
    const truthy = await submit("normal", { gameId: "test-game", score: 40, daily: "yes" });
    expect(truthy.body.daily).toBeUndefined();
    expect(await api.db.select().from(dailyRuns).where(eq(dailyRuns.userId, "normal"))).toEqual([]);
  });

  test("the board is today's runs, highest first, public fields only", async () => {
    await api.addUser({ id: "high", screenName: "high-flyer", avatar: 4, xpLevel: 3 });
    await api.addUser({ id: "banned" });
    await submit("high", { gameId: "test-game", score: 300, daily: true });
    await submit("banned", { gameId: "test-game", score: 900, daily: true });
    await api.db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, "banned"));

    const res = await daily();
    expect(res.body.board[0]).toEqual({
      userId: "high",
      screenName: "high-flyer",
      avatar: 4,
      level: 3,
      score: 300,
    });
    const scores = res.body.board.map((r: { score: number }) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(res.body.board.some((r: { userId: string }) => r.userId === "banned")).toBe(false);

    // Another day's board (far east vs far west) never shows today's runs.
    const west = await daily(undefined, -12 * 60);
    const east = await daily(undefined, 14 * 60);
    expect(west.body.board.length === 0 || east.body.board.length === 0).toBe(true);
  });

  test("players in a block with the viewer are left off the board", async () => {
    await api.addUser({ id: "viewer" });
    await api.db.insert(blocks).values({ userId: "viewer", blockedUserId: "high" });
    const res = await daily("viewer");
    expect(res.body.board.some((r: { userId: string }) => r.userId === "high")).toBe(false);
  });
});

describe("stickers from a run (T11.4)", () => {
  test("the first run collects first-play, listed in stickersEarned and stickerEarned", async () => {
    await api.addUser({ id: "newbie" });
    const res = await submit("newbie", { gameId: "test-game", score: 10 });
    expect(res.body.stickersEarned).toEqual([{ id: "first-play", kind: "achievement" }]);
    expect(res.body.stickerEarned).toEqual({ id: "first-play", kind: "achievement" });
    const again = await submit("newbie", { gameId: "test-game", score: 5 });
    expect(again.body.stickersEarned).toEqual([]);
    expect(again.body.stickerEarned).toBeUndefined();
    const better = await submit("newbie", { gameId: "test-game", score: 50 });
    expect(better.body.stickersEarned).toEqual([{ id: "beat-best", kind: "achievement" }]);
    expect(await stickerIds("newbie")).toEqual(["beat-best", "first-play"]);
  });

  test("three daily runs in one week collect daily-trio", async () => {
    await api.addUser({ id: "trio" });
    const today = localDayFor(Date.now(), 0);
    const { monday } = isoWeekBounds(today);
    const others: string[] = [];
    for (let i = 0; i < 7 && others.length < 2; i++) {
      const day = new Date(Date.parse(`${monday}T00:00:00Z`) + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      if (day !== today) others.push(day);
    }
    for (const day of others) {
      await api.db.insert(dailyRuns).values({ userId: "trio", day, gameId: "test-game", score: 1 });
    }
    const res = await submit("trio", { gameId: "test-game", score: 10, daily: true });
    expect(res.body.daily).toMatchObject({ counted: true });
    expect(res.body.stickersEarned.map((s: { id: string }) => s.id)).toContain("daily-trio");
  });
});

describe("the friend sticker (T11.4)", () => {
  test("accepting a friend request gives both players the friend sticker", async () => {
    const asker = await api.addUser({ id: "asker" });
    const answerer = await api.addUser({ id: "answerer" });
    const sent = await api.request("POST", "/followers/request", {
      as: asker.id,
      body: { friendCode: answerer.friendCode },
    });
    expect(sent.status).toBe(200);
    expect(await stickerIds("asker")).toEqual([]);
    const ok = await api.request("POST", "/followers/requests/asker/accept", { as: "answerer" });
    expect(ok.status).toBe(200);
    expect(await stickerIds("asker")).toEqual(["friend-made"]);
    expect(await stickerIds("answerer")).toEqual(["friend-made"]);
    const [row] = await api.db
      .select()
      .from(userStickers)
      .where(and(eq(userStickers.userId, "asker"), eq(userStickers.stickerId, "friend-made")));
    expect(row?.earnedAt).toBeInstanceOf(Date);
  });
});
