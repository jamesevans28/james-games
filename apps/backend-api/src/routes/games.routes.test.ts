import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { startTestApp, type TestApp } from "../test/app.js";
import { games, plays, ratings, userGameStats } from "../db/schema.js";
import { clearFeedCache } from "../services/feedService.js";
import { seedDatabase } from "../db/seedData.js";

let api: TestApp;

beforeAll(async () => {
  api = await startTestApp();
  // Two more active games so the feed has something to rank.
  await seedDatabase(api.db, [
    {
      id: "alpha",
      title: "Alpha",
      status: "active",
      scoring: { max: 100, perSecondMax: 10, xpMultiplier: 1 },
    },
    {
      id: "bravo",
      title: "Bravo",
      status: "active",
      scoring: { max: 100, perSecondMax: 10, xpMultiplier: 1 },
    },
  ]);
  await api.addUser({ id: "kid" });
  await api.addUser({ id: "tester", betaTester: true });
  await api.addUser({ id: "boss", admin: true });
});
afterAll(() => api.close());
beforeEach(() => clearFeedCache());

const ids = (items: Array<{ gameId: string }>) => items.map((g) => g.gameId).sort();

describe("GET /games/config", () => {
  test("hides inactive games, and beta games unless the viewer is a beta tester", async () => {
    const anon = await api.request("GET", "/games/config");
    expect(anon.status).toBe(200);
    expect(ids(anon.body.items)).toEqual(["alpha", "bravo", "test-game"]);
    expect(anon.body.nextCursor).toBeUndefined();
    expect(anon.body.items.find((g: { gameId: string }) => g.gameId === "test-game")).toMatchObject(
      {
        title: "Test Game",
        betaOnly: false,
        metadata: null,
      },
    );

    const kid = await api.request("GET", "/games/config", { as: "kid" });
    expect(ids(kid.body.items)).toEqual(["alpha", "bravo", "test-game"]);

    const tester = await api.request("GET", "/games/config", { as: "tester" });
    expect(ids(tester.body.items)).toEqual(["alpha", "beta-game", "bravo", "test-game"]);
  });

  test("single game follows the same visibility", async () => {
    expect((await api.request("GET", "/games/config/test-game")).status).toBe(200);
    expect((await api.request("GET", "/games/config/old-game")).status).toBe(404);
    expect((await api.request("GET", "/games/config/beta-game", { as: "kid" })).status).toBe(404);
    const beta = await api.request("GET", "/games/config/beta-game", { as: "tester" });
    expect(beta.body).toMatchObject({ gameId: "beta-game", betaOnly: true, status: "beta" });
  });
});

describe("admin games", () => {
  test("metadata update requires an admin and only changes metadata", async () => {
    const body = { metadata: { featured: true, promoText: "New!" } };
    expect((await api.request("PATCH", "/admin/games/bravo", { body })).status).toBe(401);
    expect((await api.request("PATCH", "/admin/games/bravo", { as: "kid", body })).status).toBe(
      403,
    );

    const bad = await api.request("PATCH", "/admin/games/bravo", {
      as: "boss",
      body: { title: "Hacked", metadata: {} },
    });
    expect(bad).toEqual({ status: 400, body: { error: "only_metadata_editable" } });
    expect(
      (await api.request("PATCH", "/admin/games/bravo", { as: "boss", body: { metadata: [1] } }))
        .status,
    ).toBe(400);
    expect((await api.request("PATCH", "/admin/games/nope", { as: "boss", body })).status).toBe(
      404,
    );

    const ok = await api.request("PATCH", "/admin/games/bravo", { as: "boss", body });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ gameId: "bravo", title: "Bravo", metadata: body.metadata });

    const pub = await api.request("GET", "/games/config/bravo");
    expect(pub.body.metadata).toEqual(body.metadata);

    // Reset so the feed tests start from no featured games.
    await api.request("PATCH", "/admin/games/bravo", { as: "boss", body: { metadata: null } });
  });

  test("create is gone; list includes inactive games", async () => {
    expect(
      (await api.request("POST", "/admin/games", { as: "boss", body: { gameId: "x" } })).status,
    ).toBe(404);
    const list = await api.request("GET", "/admin/games", { as: "boss" });
    expect(ids(list.body.items)).toEqual(["alpha", "beta-game", "bravo", "old-game", "test-game"]);
  });

  test("game stats are SQL aggregates over the last four weeks", async () => {
    await api.addUser({ id: "p1" });
    await api.addUser({ id: "p2" });
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await api.db.insert(plays).values([
      { userId: "p1", gameId: "old-game", score: 10 },
      { userId: "p1", gameId: "old-game", score: 30 },
      { userId: "p2", gameId: "old-game", score: 50 },
      { userId: "p2", gameId: "old-game", score: 999, createdAt: old },
    ]);
    const res = await api.request("GET", "/admin/games/old-game/stats", { as: "boss" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      gameId: "old-game",
      totalPlays: 3,
      averageScore: 30,
      uniquePlayers: 2,
    });
    expect(res.body.weeklyBreakdown).toHaveLength(4);
    expect(res.body.weeklyBreakdown[3].count).toBe(3);
    expect((await api.request("GET", "/admin/games/nope/stats", { as: "boss" })).status).toBe(404);
  });
});

describe("feed", () => {
  test("ranks by recent plays, then rating, then last update", async () => {
    const stale = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    await api.addUser({ id: "r1" });
    await api.db.insert(plays).values([
      { userId: "r1", gameId: "alpha", score: 1 },
      { userId: "r1", gameId: "alpha", score: 2 },
      { userId: "r1", gameId: "bravo", score: 1 },
      // Older than 14 days: does not count.
      ...Array.from({ length: 5 }, () => ({
        userId: "r1",
        gameId: "test-game",
        score: 1,
        createdAt: stale,
      })),
      // Beta plays never surface beta games in the public feed.
      ...Array.from({ length: 5 }, () => ({ userId: "r1", gameId: "beta-game", score: 1 })),
    ]);
    await api.db.insert(ratings).values([
      { userId: "r1", gameId: "test-game", stars: 5 },
      { userId: "kid", gameId: "test-game", stars: 4 },
    ]);

    const res = await api.request("GET", "/games/feed");
    expect(res.status).toBe(200);
    expect(res.body.orderedGameIds).toEqual(["alpha", "bravo", "test-game"]);
    expect(res.body.total).toBe(3);
    expect(res.body.reasons.alpha).toBe("popular");
    expect(res.body.scores.alpha).toBeGreaterThan(res.body.scores.bravo);

    // Equal plays: the better-rated game wins.
    await api.db.insert(ratings).values({ userId: "r1", gameId: "bravo", stars: 5 });
    await api.db.insert(plays).values({ userId: "r1", gameId: "bravo", score: 1 });
    await api.db.insert(ratings).values({ userId: "r1", gameId: "alpha", stars: 2 });
    clearFeedCache();
    expect((await api.request("GET", "/games/feed")).body.orderedGameIds).toEqual([
      "bravo",
      "alpha",
      "test-game",
    ]);

    // Equal plays and no ratings: the most recently updated game wins.
    await api.db.delete(ratings);
    await api.db
      .update(games)
      .set({ updatedAt: new Date(Date.now() + 1000) })
      .where(eq(games.id, "alpha"));
    clearFeedCache();
    expect((await api.request("GET", "/games/feed")).body.orderedGameIds).toEqual([
      "alpha",
      "bravo",
      "test-game",
    ]);
    await api.db
      .update(games)
      .set({ updatedAt: new Date(Date.now() + 2000) })
      .where(eq(games.id, "bravo"));
    clearFeedCache();
    expect((await api.request("GET", "/games/feed?limit=1")).body).toMatchObject({
      orderedGameIds: ["bravo"],
      total: 3,
    });
  });

  test("personalized feed mixes in the viewer's play history and beta games", async () => {
    expect((await api.request("GET", "/games/feed/personalized")).status).toBe(401);
    await api.db
      .insert(userGameStats)
      .values([{ userId: "tester", gameId: "bravo", plays: 3, lastPlayedAt: new Date() }]);
    const res = await api.request("GET", "/games/feed/personalized", { as: "tester" });
    expect(res.status).toBe(200);
    expect(res.body.orderedGameIds).toEqual(["beta-game", "alpha", "bravo", "test-game"]);
    expect(res.body.reasons).toMatchObject({
      "beta-game": "beta",
      bravo: "user_recent",
      alpha: "popular",
    });
    expect(res.body.userRecentGames).toEqual(["bravo"]);

    const kid = await api.request("GET", "/games/feed/personalized", { as: "kid" });
    expect(kid.body.orderedGameIds).not.toContain("beta-game");
  });
});
