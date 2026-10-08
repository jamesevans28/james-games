import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { follows, presence } from "../db/schema.js";
import { startTestApp, type TestApp } from "../test/app.js";

const PRIVATE_KEYS = [
  "email",
  "admin",
  "prefs",
  "preferences",
  "lastSeenAt",
  "lastUpdated",
  "pinHash",
  "username",
];

function expectNoPrivateFields(value: unknown) {
  const json = JSON.stringify(value);
  for (const key of PRIVATE_KEYS) expect(json).not.toContain(`"${key}"`);
  expect(json).not.toContain("@example.com");
}

describe("/followers", () => {
  let api: TestApp;

  beforeAll(async () => {
    api = await startTestApp();
    await api.addUser({
      id: "ana",
      screenName: "ana-otter",
      avatar: 3,
      email: "ana@example.com",
      username: "ana",
      admin: true,
      prefs: { theme: "dark" },
      xpLevel: 4,
      lastSeenAt: new Date(),
    });
    await api.addUser({ id: "ben", screenName: "ben-badger", avatar: 5, xpLevel: 2 });
    await api.addUser({ id: "cat", screenName: "cat-cobra", email: "cat@example.com" });
    await api.addUser({ id: "dan", screenName: "dan-dingo", disabledAt: new Date() });
  });
  afterAll(() => api.close());

  it("requires sign-in", async () => {
    expect((await api.request("GET", "/followers/summary")).status).toBe(401);
    expect((await api.request("POST", "/followers/ben")).status).toBe(401);
  });

  it("follows, rejects duplicates, self-follows, missing users and disabled followers", async () => {
    expect(await api.request("POST", "/followers/ana", { as: "ben" })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect((await api.request("POST", "/followers/ana", { as: "cat" })).status).toBe(200);
    expect((await api.request("POST", "/followers/ben", { as: "ana" })).status).toBe(200);

    expect(await api.request("POST", "/followers/ana", { as: "ben" })).toEqual({
      status: 409,
      body: { error: "already_following" },
    });
    expect(await api.request("POST", "/followers/ben", { as: "ben" })).toEqual({
      status: 400,
      body: { error: "cannot_follow_self" },
    });
    expect(await api.request("POST", "/followers/nobody", { as: "ben" })).toEqual({
      status: 404,
      body: { error: "user_not_found" },
    });
    expect(await api.request("POST", "/followers/ana", { as: "dan" })).toEqual({
      status: 403,
      body: { error: "account_disabled" },
    });
  });

  it("lists following, followers, ids and counts with public fields only", async () => {
    const summary = await api.request("GET", "/followers/summary", { as: "ana" });
    expect(summary.status).toBe(200);
    expect(summary.body.followingCount).toBe(1);
    expect(summary.body.followersCount).toBe(2);
    expect(summary.body.following).toEqual([
      expect.objectContaining({
        userId: "ben",
        targetUserId: "ben",
        screenName: "ben-badger",
        targetScreenName: "ben-badger",
        avatar: 5,
        level: 2,
        presence: null,
        lastOnline: null,
      }),
    ]);
    expect(summary.body.followers.map((f: { userId: string }) => f.userId).sort()).toEqual([
      "ben",
      "cat",
    ]);
    expectNoPrivateFields(summary.body);

    const ofBen = await api.request("GET", "/followers/summary", { as: "ben" });
    expect(ofBen.body.following[0]).toMatchObject({
      userId: "ana",
      screenName: "ana-otter",
      avatar: 3,
      level: 4,
    });
    expectNoPrivateFields(ofBen.body);

    const following = await api.request("GET", "/followers/following", { as: "ben" });
    expect(following.body.following[0]).toMatchObject({
      userId: "ben",
      targetUserId: "ana",
      targetScreenName: "ana-otter",
      targetExperience: { level: 4 },
    });
    expectNoPrivateFields(following.body);

    const followers = await api.request("GET", "/followers/followers", { as: "ana" });
    expect(followers.body.followers).toHaveLength(2);
    expect(followers.body.followers[0]).toMatchObject({ targetUserId: "ana" });
    expectNoPrivateFields(followers.body);

    expect((await api.request("GET", "/followers/ids", { as: "ben" })).body).toEqual({
      userIds: ["ana"],
    });

    const notes = await api.request("GET", "/followers/notifications", { as: "ana" });
    expect(notes.body.notifications).toHaveLength(2);
    expect(Object.keys(notes.body.notifications[0]).sort()).toEqual([
      "avatar",
      "createdAt",
      "screenName",
      "userId",
    ]);
  });

  it("ignores pending edges", async () => {
    await api.db.insert(follows).values({ userId: "cat", targetUserId: "ben", status: "pending" });
    const ids = await api.request("GET", "/followers/ids", { as: "cat" });
    expect(ids.body.userIds).toEqual(["ana"]);
    const summary = await api.request("GET", "/followers/summary", { as: "ben" });
    expect(summary.body.followersCount).toBe(1);
  });

  it("updates presence, derives the game title and filters activity", async () => {
    expect(
      await api.request("POST", "/followers/status", {
        as: "ana",
        body: { status: "playing", gameId: "test-game", gameTitle: "Hacked Title" },
      }),
    ).toEqual({ status: 200, body: { ok: true } });

    const summary = await api.request("GET", "/followers/summary", { as: "ben" });
    expect(summary.body.following[0].presence).toMatchObject({
      status: "playing",
      gameId: "test-game",
      gameTitle: "Test Game",
    });
    expect(typeof summary.body.following[0].lastOnline).toBe("string");

    const inGame = await api.request(
      "GET",
      "/followers/activity?gameId=test-game&status=playing,game_lobby",
      { as: "ben" },
    );
    expect(inGame.body.activity).toHaveLength(1);
    expect(inGame.body.activity[0]).toMatchObject({
      targetUserId: "ana",
      targetScreenName: "ana-otter",
      presence: { status: "playing", gameTitle: "Test Game" },
    });
    expectNoPrivateFields(inGame.body);

    const otherGame = await api.request("GET", "/followers/activity?gameId=beta-game", {
      as: "ben",
    });
    expect(otherGame.body.activity).toEqual([]);
    const otherStatus = await api.request("GET", "/followers/activity?status=home", { as: "ben" });
    expect(otherStatus.body.activity).toEqual([]);
    const junkStatus = await api.request("GET", "/followers/activity?status=nonsense", {
      as: "ben",
    });
    expect(junkStatus.body.activity).toEqual([]);

    // Presence without a game clears the game.
    await api.request("POST", "/followers/status", { as: "ana", body: { status: "home" } });
    const home = await api.request("GET", "/followers/activity", { as: "ben" });
    expect(home.body.activity[0].presence).toMatchObject({
      status: "home",
      gameId: null,
      gameTitle: null,
    });
  });

  it("rejects invalid presence", async () => {
    expect(
      await api.request("POST", "/followers/status", { as: "ana", body: { status: "hacking" } }),
    ).toEqual({ status: 400, body: { error: "invalid_status" } });
    expect(await api.request("POST", "/followers/status", { as: "ana", body: {} })).toEqual({
      status: 400,
      body: { error: "status_required" },
    });
    expect(
      await api.request("POST", "/followers/status", {
        as: "ana",
        body: { status: "playing", gameId: "no-such-game" },
      }),
    ).toEqual({ status: 400, body: { error: "invalid_game" } });
    expect(
      await api.request("POST", "/followers/status", {
        as: "ana",
        body: { status: "playing", gameId: 42 },
      }),
    ).toEqual({ status: 400, body: { error: "invalid_game" } });
    expect(
      (
        await api.request("POST", "/followers/status", {
          as: "ghost",
          body: { status: "home" },
        })
      ).status,
    ).toBe(404);
  });

  it("treats presence older than 2 minutes as offline", async () => {
    const old = new Date(Date.now() - 3 * 60 * 1000);
    await api.db
      .insert(presence)
      .values({ userId: "cat", status: "playing", gameId: "test-game", updatedAt: old })
      .onConflictDoUpdate({
        target: presence.userId,
        set: { status: "playing", gameId: "test-game", updatedAt: old },
      });
    // ana follows cat for this check.
    expect((await api.request("POST", "/followers/cat", { as: "ana" })).status).toBe(200);

    const summary = await api.request("GET", "/followers/summary", { as: "ana" });
    const catEntry = summary.body.following.find((f: { userId: string }) => f.userId === "cat");
    expect(catEntry.presence).toBeNull();
    expect(catEntry.lastOnline).toBe(old.toISOString());

    const activity = await api.request("GET", "/followers/activity?gameId=test-game", {
      as: "ana",
    });
    expect(activity.body.activity).toEqual([]);
  });

  it("unfollows", async () => {
    expect(await api.request("DELETE", "/followers/ana", { as: "ben" })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect((await api.request("GET", "/followers/ids", { as: "ben" })).body.userIds).toEqual([]);
    const summary = await api.request("GET", "/followers/summary", { as: "ana" });
    expect(summary.body.followersCount).toBe(1);
    // Unfollowing again is harmless.
    expect((await api.request("DELETE", "/followers/ana", { as: "ben" })).status).toBe(200);
  });
});
