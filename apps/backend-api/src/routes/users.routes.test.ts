import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, type TestApp } from "../test/app.js";
import { follows } from "../db/schema.js";
import { getUserById } from "../repos/usersRepo.js";

describe("/users routes", () => {
  let api: TestApp;
  beforeAll(async () => {
    api = await startTestApp();
  });
  afterAll(() => api.close());

  it("screen-name, settings and PATCH /me/screen-name rename with rules, uniqueness and a limit", async () => {
    await api.addUser({ id: "sn-1", screenName: "First" });
    await api.addUser({ id: "sn-2", screenName: "Taken Name" });

    expect((await api.request("POST", "/users/screen-name", { body: {} })).status).toBe(401);
    const tooShort = await api.request("POST", "/users/screen-name", {
      as: "sn-1",
      body: { screenName: " a " },
    });
    expect(tooShort.status).toBe(400);

    const ok = await api.request("POST", "/users/screen-name", {
      as: "sn-1",
      body: { screenName: "  Bouncy Otter  " },
    });
    expect(ok.body).toEqual({ ok: true, screenName: "Bouncy Otter" });
    expect(await getUserById("sn-1")).toMatchObject({
      screenName: "Bouncy Otter",
      screenNameSetByUser: true,
    });

    // Re-casing your own name is not a clash.
    const recase = await api.request("PATCH", "/users/settings", {
      as: "sn-1",
      body: { screenName: "bouncy otter" },
    });
    expect(recase.body).toEqual({ ok: true, screenName: "bouncy otter" });

    const clash = await api.request("PATCH", "/users/settings", {
      as: "sn-1",
      body: { screenName: "TAKEN NAME" },
    });
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe("taken");

    const rude = await api.request("PATCH", "/me/screen-name", {
      as: "sn-1",
      body: { screenName: "shit head" },
    });
    expect(rude.status).toBe(400);
    expect(rude.body.code).toBe("not_allowed");

    const check = await api.request("GET", "/users/screen-name/check?name=taken%20name", {
      as: "sn-1",
    });
    expect(check.body).toMatchObject({ ok: false, code: "taken" });
    const free = await api.request("GET", "/users/screen-name/check?name=Zoomy", { as: "sn-1" });
    expect(free.body).toEqual({ ok: true, name: "Zoomy" });

    // Third change in 30 days is fine, the fourth is refused.
    const third = await api.request("PATCH", "/me/screen-name", {
      as: "sn-1",
      body: { screenName: "Zoomy" },
    });
    expect(third.body).toEqual({ ok: true, screenName: "Zoomy" });
    const fourth = await api.request("PATCH", "/me/screen-name", {
      as: "sn-1",
      body: { screenName: "Zoomier" },
    });
    expect(fourth.status).toBe(429);
    expect(fourth.body.code).toBe("too_many_changes");

    const missing = await api.request("PATCH", "/users/settings", {
      as: "no-row",
      body: { screenName: "Ghost" },
    });
    expect(missing.status).toBe(404);
  });

  it("preferences sets avatar and prefs, and validates them", async () => {
    await api.addUser({ id: "pref-1" });
    const ok = await api.request("POST", "/users/preferences", {
      as: "pref-1",
      body: { avatar: 5, preferences: { sound: false } },
    });
    expect(ok).toEqual({ status: 200, body: { ok: true } });
    expect(await getUserById("pref-1")).toMatchObject({ avatar: 5, prefs: { sound: false } });

    const me = await api.request("GET", "/me", { as: "pref-1" });
    expect(me.body.user).toMatchObject({ avatar: 5, preferences: { sound: false } });

    for (const body of [{ avatar: 0 }, { avatar: "3" }, { preferences: [1] }]) {
      const bad = await api.request("POST", "/users/preferences", { as: "pref-1", body });
      expect(bad.status, JSON.stringify(body)).toBe(400);
    }
    expect((await api.request("POST", "/users/preferences", { body: {} })).status).toBe(401);
  });

  it("GET /users/:userId is public and whitelisted", async () => {
    await api.addUser({
      id: "pub-1",
      username: "secret_login",
      screenName: "Public Pat",
      avatar: 2,
      email: "pat@example.com",
      admin: true,
      prefs: { theme: "dark" },
      streakCurrent: 4,
      streakLongest: 6,
      streakLastDay: "2019-03-07",
      lastSeenAt: new Date("2019-03-07T10:00:00Z"),
      pinHash: "hash-value",
    });
    await api.addUser({ id: "fan-1", screenName: "Fan One", avatar: 3 });
    await api.db.insert(follows).values({ userId: "fan-1", targetUserId: "pub-1" });

    const anon = await api.request("GET", "/users/pub-1");
    expect(anon.status).toBe(200);
    expect(Object.keys(anon.body.profile).sort()).toEqual([
      "avatar",
      "createdAt",
      "currentStreak",
      "experience",
      "longestStreak",
      "screenName",
      "userId",
    ]);
    expect(anon.body.profile).toMatchObject({
      userId: "pub-1",
      screenName: "Public Pat",
      avatar: 2,
      currentStreak: 4,
      longestStreak: 6,
    });
    expect(anon.body).toMatchObject({
      followingCount: 0,
      followersCount: 1,
      following: [],
      followers: [{ userId: "fan-1", screenName: "Fan One", avatar: 3 }],
      recentGames: [],
      isSelf: false,
      isFollowing: false,
    });
    const json = JSON.stringify(anon.body);
    for (const secret of [
      "pat@example.com",
      "secret_login",
      "admin",
      "prefs",
      "preferences",
      "dark",
      "hash-value",
      "2019-03-07",
      "lastSeen",
    ]) {
      expect(json, `leaked ${secret}`).not.toContain(secret);
    }

    const asFan = await api.request("GET", "/users/pub-1", { as: "fan-1" });
    expect(asFan.body).toMatchObject({ isSelf: false, isFollowing: true });
    const asSelf = await api.request("GET", "/users/pub-1", { as: "pub-1" });
    expect(asSelf.body).toMatchObject({ isSelf: true, isFollowing: false });

    expect((await api.request("GET", "/users/nobody")).status).toBe(404);
  });
});
