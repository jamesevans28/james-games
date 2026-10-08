import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import type { Db } from "../db/client.js";
import { bestScores, plays, screenNameHistory, userGameStats, users } from "../db/schema.js";
import { createTestDb } from "../test/db.js";
import {
  AdminError,
  deletePlay,
  getAdminUser,
  listUsers,
  resetScreenName,
  setUserDisabled,
  updateAdminUser,
} from "./adminUserService.js";

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "boss", screenName: "Boss", admin: true },
    { id: "kid", screenName: "Rude-Name", screenNameSetByUser: true, username: "kiddo" },
    { id: "other", screenName: "HappyHippo" },
  ]);
});

async function rejectsWith(p: Promise<unknown>, status: number, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AdminError);
  expect(err).toMatchObject({ status, code });
}

describe("listUsers", () => {
  test("searches screen name and username, pages by offset", async () => {
    expect((await listUsers({ search: "rude" })).items.map((u) => u.userId)).toEqual(["kid"]);
    expect((await listUsers({ search: "KIDD" })).items.map((u) => u.userId)).toEqual(["kid"]);
    expect((await listUsers({ search: "100%" })).items).toEqual([]);
    const page1 = await listUsers({ limit: 5 });
    expect(page1.items).toHaveLength(3);
    expect(page1.nextCursor).toBeUndefined();
  });
});

describe("moderation", () => {
  test("disable and enable an account", async () => {
    const disabled = await setUserDisabled("boss", "kid", true);
    expect(disabled.enabled).toBe(false);
    expect(disabled.disabledAt).toEqual(expect.any(String));
    // Disabling twice keeps the first timestamp.
    expect((await setUserDisabled("boss", "kid", true)).disabledAt).toBe(disabled.disabledAt);
    const enabled = await setUserDisabled("boss", "kid", false);
    expect(enabled.enabled).toBe(true);
    expect(enabled.disabledAt).toBeNull();
    await rejectsWith(setUserDisabled("boss", "boss", true), 400, "cannot_disable_self");
    await rejectsWith(setUserDisabled("boss", "ghost", true), 404, "user_not_found");
  });

  test("reset screen name to a generated one and record history", async () => {
    const after = await resetScreenName("kid");
    expect(after.screenName).not.toBe("Rude-Name");
    expect(after.screenName).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
    const [row] = await db.select().from(users).where(eq(users.id, "kid"));
    expect(row!.screenNameSetByUser).toBe(false);
    const history = await db
      .select()
      .from(screenNameHistory)
      .where(eq(screenNameHistory.userId, "kid"));
    expect(history).toEqual([
      expect.objectContaining({ oldName: "Rude-Name", newName: after.screenName }),
    ]);
    await rejectsWith(resetScreenName("ghost"), 404, "user_not_found");
  });

  test("update flags only, and not your own admin flag", async () => {
    expect((await updateAdminUser("boss", "other", { betaTester: true })).betaTester).toBe(true);
    await rejectsWith(updateAdminUser("boss", "other", {}), 400, "no_changes_provided");
    await rejectsWith(updateAdminUser("boss", "other", { admin: "yes" }), 400, "invalid_flag");
    await rejectsWith(
      updateAdminUser("boss", "boss", { admin: false }),
      400,
      "cannot_remove_own_admin",
    );
  });

  test("delete a play recomputes best score and stats from what remains", async () => {
    const t = (min: number) => new Date(Date.UTC(2026, 9, 1, 12, min));
    const inserted = await db
      .insert(plays)
      .values([
        { userId: "other", gameId: "test-game", score: 100, createdAt: t(0) },
        { userId: "other", gameId: "test-game", score: 900, createdAt: t(1) },
        { userId: "other", gameId: "test-game", score: 300, createdAt: t(2) },
      ])
      .returning();
    const [low, cheat, last] = inserted;
    await db.insert(bestScores).values({
      userId: "other",
      gameId: "test-game",
      score: 900,
      playId: cheat!.id,
      achievedAt: t(1),
    });
    await db.insert(userGameStats).values({
      userId: "other",
      gameId: "test-game",
      plays: 3,
      bestScore: 900,
      lastScore: 300,
      lastPlayedAt: t(2),
    });

    expect(await deletePlay(cheat!.id)).toMatchObject({ deleted: true, bestScore: 300 });
    const where = (tbl: typeof bestScores | typeof userGameStats) =>
      and(eq(tbl.userId, "other"), eq(tbl.gameId, "test-game"));
    let [best] = await db.select().from(bestScores).where(where(bestScores));
    expect(best).toMatchObject({ score: 300, playId: last!.id });
    let [stats] = await db.select().from(userGameStats).where(where(userGameStats));
    expect(stats).toMatchObject({ plays: 2, bestScore: 300, lastScore: 300 });

    // Deleting the latest play moves "last" back too.
    await deletePlay(last!.id);
    [stats] = await db.select().from(userGameStats).where(where(userGameStats));
    expect(stats).toMatchObject({ plays: 1, bestScore: 100, lastScore: 100 });
    expect(stats!.lastPlayedAt.toISOString()).toBe(t(0).toISOString());

    // Deleting the only play left removes the board row and the stats row.
    expect(await deletePlay(low!.id)).toMatchObject({ bestScore: null });
    [best] = await db.select().from(bestScores).where(where(bestScores));
    expect(best).toBeUndefined();
    [stats] = await db.select().from(userGameStats).where(where(userGameStats));
    expect(stats).toBeUndefined();

    await rejectsWith(deletePlay(low!.id), 404, "play_not_found");
  });

  test("user detail includes per-game stats and recent plays", async () => {
    await db.insert(plays).values({ userId: "kid", gameId: "beta-game", score: 42 });
    await db.insert(userGameStats).values({
      userId: "kid",
      gameId: "beta-game",
      plays: 1,
      bestScore: 42,
      lastScore: 42,
    });
    const detail = await getAdminUser("kid");
    expect(detail.gameStats).toEqual([
      expect.objectContaining({ gameId: "beta-game", title: "Beta Game", bestScore: 42 }),
    ]);
    expect(detail.recentPlays).toEqual([
      expect.objectContaining({ gameId: "beta-game", score: 42, playId: expect.any(String) }),
    ]);
  });
});
