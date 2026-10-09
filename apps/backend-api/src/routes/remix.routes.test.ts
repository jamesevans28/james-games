import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { and, eq } from "drizzle-orm";
import { seedDatabase } from "../db/seedData.js";
import { startTestApp, type TestApp } from "../test/app.js";
import { bestScores, plays } from "../db/schema.js";

// Remix mode (T11.2). Snapadile's knobs come from the bundled game-meta.json:
// speed 0.5–2.5 (step 0.25), lives 1–5, crocSize 0.6–1.4 (step 0.1).

let api: TestApp;
beforeAll(async () => {
  api = await startTestApp();
  await seedDatabase(api.db, [
    {
      id: "snapadile",
      title: "Snapadile",
      status: "active",
      scoring: { max: 10_000, perSecondMax: 15, xpMultiplier: 1.93 },
    },
  ]);
  await api.addUser({ id: "tilly", screenName: "tilly-croc" });
  await api.addUser({ id: "harvey", screenName: "harvey-hoops" });
  await api.addUser({ id: "guest", screenName: "guest-1", accountType: "anonymous" });
});
afterAll(() => api.close());

const crocs = { gameId: "snapadile", name: "Tilly's super-fast crocs", knobs: { speed: 2.5 } };

const play = (as: string, body: Record<string, unknown>) =>
  api.request("POST", "/scores", {
    as,
    body: { gameId: "snapadile", durationMs: 60_000, tzOffsetMinutes: 0, ...body },
  });

describe("remixes", () => {
  test("Tilly saves a remix, Harvey beats her on it, and it has its own board", async () => {
    const saved = await api.request("POST", "/remixes", { as: "tilly", body: crocs });
    expect(saved.status).toBe(201);
    const remix = saved.body.remix;
    expect(remix).toMatchObject({
      gameId: "snapadile",
      name: "Tilly's super-fast crocs",
      knobs: { speed: 2.5, lives: 3, crocSize: 1 },
      isMine: true,
    });

    // The shared link is public: name, game, knobs and the maker's screen name only.
    const shared = await api.request("GET", `/remixes/${remix.id}`);
    expect(shared.status).toBe(200);
    expect(shared.body.remix).toEqual({
      id: remix.id,
      gameId: "snapadile",
      name: "Tilly's super-fast crocs",
      knobs: { speed: 2.5, lives: 3, crocSize: 1 },
      createdAt: remix.createdAt,
      owner: { screenName: "tilly-croc", avatar: 1 },
      isMine: false,
    });
    expect(JSON.stringify(shared.body)).not.toContain('"tilly"');

    const tillyRun = await play("tilly", { score: 30, remixId: remix.id });
    expect(tillyRun.status).toBe(200);
    expect(tillyRun.body.newBest).toBe(true);
    expect(tillyRun.body.awardedXp).toBeGreaterThan(0); // remix runs still earn XP

    const harveyRun = await play("harvey", { score: 45, remixId: remix.id });
    expect(harveyRun.body.newBest).toBe(true);
    const tillyAgain = await play("tilly", { score: 20, remixId: remix.id });
    expect(tillyAgain.body.newBest).toBe(false);

    const board = await api.request("GET", `/remixes/${remix.id}/scores`);
    expect(board.status).toBe(200);
    expect(
      board.body.map((r: { screenName: string; score: number }) => [r.screenName, r.score]),
    ).toEqual([
      ["harvey-hoops", 45],
      ["tilly-croc", 30],
    ]);

    // The plays carry the remix; the normal board and bests are untouched.
    const rows = await api.db.select().from(plays).where(eq(plays.remixId, remix.id));
    expect(rows).toHaveLength(3);
    const normal = await api.request("GET", "/scores/snapadile");
    expect(normal.body).toEqual([]);
    const bests = await api.db
      .select()
      .from(bestScores)
      .where(and(eq(bestScores.gameId, "snapadile"), eq(bestScores.userId, "harvey")));
    expect(bests).toEqual([]);

    // A normal run still lands on the normal board.
    await play("harvey", { score: 12 });
    const after = await api.request("GET", "/scores/snapadile");
    expect(after.body.map((r: { score: number }) => r.score)).toEqual([12]);

    const mine = await api.request("GET", "/remixes/mine?gameId=snapadile", { as: "tilly" });
    expect(mine.body.remixes.map((r: { id: string }) => r.id)).toEqual([remix.id]);
    const harveys = await api.request("GET", "/remixes/mine", { as: "harvey" });
    expect(harveys.body.remixes).toEqual([]);
  });

  test("saving needs a registered account", async () => {
    expect((await api.request("POST", "/remixes", { body: crocs })).status).toBe(401);
    const guest = await api.request("POST", "/remixes", {
      as: "guest",
      accountType: "anonymous",
      body: crocs,
    });
    expect(guest.status).toBe(403);
    expect(guest.body.error).toBe("account_upgrade_required");
  });

  test.each([
    [{ ...crocs, name: "fuck crocs" }, "name_not_allowed"],
    [{ ...crocs, name: "see site.com" }, "name_bad_characters"],
    [{ ...crocs, name: "x" }, "name_too_short"],
    [{ ...crocs, knobs: { speed: 9 } }, "knobs_out_of_range"],
    [{ ...crocs, knobs: { speed: 1.1 } }, "knobs_out_of_range"],
    [{ ...crocs, knobs: { speed: 2, xpMultiplier: 50 } }, "knobs_unknown_knob"],
    [{ ...crocs, knobs: { speed: 1 } }, "knobs_unchanged"],
    [{ ...crocs, knobs: "fast" }, "knobs_bad_knobs"],
    [{ ...crocs, gameId: "test-game" }, "knobs_no_knobs"],
    [{ ...crocs, gameId: "../etc" }, "game_invalid"],
  ])("refuses a bad remix (%#: %s)", async (body, code) => {
    const res = await api.request("POST", "/remixes", { as: "tilly", body });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
    expect(typeof res.body.error).toBe("string");
  });

  test("a run with a bad remix id is refused, not put on the normal board", async () => {
    const saved = await api.request("POST", "/remixes", {
      as: "tilly",
      body: { ...crocs, name: "Slow crocs", knobs: { speed: 0.5 } },
    });
    const id = saved.body.remix.id as string;
    // Another game's run can't use it.
    const other = await api.request("POST", "/scores", {
      as: "harvey",
      body: { gameId: "test-game", score: 5, durationMs: 10_000, remixId: id },
    });
    expect(other.status).toBe(400);
    expect(other.body.error).toBe("remix_invalid");
    for (const remixId of ["not-a-uuid", "6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b", 7]) {
      const res = await play("harvey", { score: 5, remixId });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("remix_invalid");
    }
  });

  test("unknown remixes are 404s", async () => {
    for (const path of [
      "/remixes/not-a-uuid",
      "/remixes/6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b",
      "/remixes/6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b/scores",
    ]) {
      const res = await api.request("GET", path);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("remix_not_found");
    }
  });
});
