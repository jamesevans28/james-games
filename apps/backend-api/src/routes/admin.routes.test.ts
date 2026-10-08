import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { plays } from "../db/schema.js";
import { startTestApp, type TestApp } from "../test/app.js";

describe("admin routes", () => {
  let api: TestApp;
  beforeAll(async () => {
    api = await startTestApp();
    await api.addUser({ id: "boss", admin: true });
    await api.addUser({ id: "kid" });
    await api.addUser({ id: "pal" });
  });
  afterAll(() => api.close());

  test("non-admins get 403 on every admin route", async () => {
    for (const [method, path] of [
      ["GET", "/admin/users"],
      ["GET", "/admin/metrics/dashboard"],
      ["POST", "/admin/users/pal/disable"],
      ["POST", "/admin/users/pal/reset-screen-name"],
      ["DELETE", "/admin/plays/00000000-0000-0000-0000-000000000000"],
    ] as const) {
      expect((await api.request(method, path, { as: "kid" })).status).toBe(403);
    }
  });

  test("dashboard aggregates inserted plays", async () => {
    const now = Date.now();
    const ago = (h: number) => new Date(now - h * 3600_000);
    await api.db.insert(plays).values([
      { userId: "kid", gameId: "test-game", score: 10, createdAt: ago(1) },
      { userId: "kid", gameId: "test-game", score: 20, createdAt: ago(2) },
      { userId: "pal", gameId: "test-game", score: 30, createdAt: ago(3) },
      { userId: "pal", gameId: "beta-game", score: 40, createdAt: ago(4) },
      // Outside the 7-day window, inside the 14-day daily series.
      { userId: "pal", gameId: "beta-game", score: 99, createdAt: ago(24 * 9) },
    ]);
    const res = await api.request("GET", "/admin/metrics/dashboard", { as: "boss" });
    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.totals).toMatchObject({ users: 3, admins: 1, newUsers7d: 3, gamesLive: 2 });
    expect(body.activity).toEqual({ activeUsers7d: 2, totalPlays7d: 4, avgScore7d: 25 });
    expect(
      body.topGames.map((g: { gameId: string; plays7d: number }) => [g.gameId, g.plays7d]),
    ).toEqual([
      ["test-game", 3],
      ["beta-game", 1],
    ]);
    expect(body.topGames[0].share).toBe(0.75);
    expect(body.daily).toHaveLength(14);
    const sum = (k: string) =>
      body.daily.reduce((n: number, d: Record<string, number>) => n + d[k]!, 0);
    expect(sum("plays")).toBe(5);
    expect(sum("newUsers")).toBe(3);
    expect(body.daily.at(-1).newUsers).toBe(3);
  });

  test("moderation routes", async () => {
    const off = await api.request("POST", "/admin/users/pal/disable", { as: "boss" });
    expect(off).toMatchObject({ status: 200, body: { userId: "pal", enabled: false } });
    expect((await api.request("POST", "/admin/users/boss/disable", { as: "boss" })).body).toEqual({
      error: "cannot_disable_self",
    });
    const on = await api.request("POST", "/admin/users/pal/enable", { as: "boss" });
    expect(on.body.enabled).toBe(true);

    const renamed = await api.request("POST", "/admin/users/pal/reset-screen-name", { as: "boss" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.screenName).not.toBe("player-pal");

    const detail = await api.request("GET", "/admin/users/pal", { as: "boss" });
    const playId = detail.body.recentPlays[0].playId as string;
    expect((await api.request("DELETE", `/admin/plays/${playId}`, { as: "boss" })).status).toBe(
      200,
    );
    expect((await api.request("DELETE", `/admin/plays/${playId}`, { as: "boss" })).status).toBe(
      404,
    );
    expect((await api.request("DELETE", "/admin/plays/nope", { as: "boss" })).status).toBe(400);
    expect((await api.request("GET", "/admin/users/ghost", { as: "boss" })).status).toBe(404);

    const list = await api.request("GET", "/admin/users?search=player-k", { as: "boss" });
    expect(list.body.items.map((u: { userId: string }) => u.userId)).toEqual(["kid"]);
  });
});
