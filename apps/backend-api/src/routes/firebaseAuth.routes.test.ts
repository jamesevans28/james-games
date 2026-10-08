import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, like } from "drizzle-orm";
import { startTestApp, type TestApp } from "../test/app.js";
import { getUserById } from "../repos/usersRepo.js";
import * as firebase from "../services/firebaseAuthService.js";
import { authAttempts, bestScores, follows, plays, userStickers } from "../db/schema.js";

// Firebase Admin is faked: the harness verifies tokens, these stand in for the rest.
vi.mock("../services/firebaseAuthService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/firebaseAuthService.js")>();
  return {
    ...actual,
    createCustomToken: vi.fn((uid: string) => Promise.resolve(`custom-token-for-${uid}`)),
    setUserClaims: vi.fn(() => Promise.resolve()),
    updateFirebaseUserEmail: vi.fn(() => Promise.resolve()),
    checkEmailVerified: vi.fn(() => Promise.resolve(true)),
    getFirebaseUser: vi.fn(() => Promise.resolve(null)),
    deleteFirebaseUser: vi.fn(() => Promise.resolve()),
  };
});

describe("/auth/firebase routes", () => {
  let api: TestApp;
  beforeAll(async () => {
    api = await startTestApp();
  });
  afterAll(() => api.close());
  beforeEach(async () => {
    vi.clearAllMocks();
    // Every request comes from 127.0.0.1, so start each test with a clean throttle.
    await api.db.delete(authAttempts);
  });

  it("register-anonymous creates the row once with a generated screen name", async () => {
    expect((await api.request("POST", "/auth/firebase/register-anonymous")).status).toBe(401);

    const first = await api.request("POST", "/auth/firebase/register-anonymous", {
      as: "anon-1",
      accountType: "anonymous",
    });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      ok: true,
      userId: "anon-1",
      accountType: "anonymous",
      isNew: true,
    });
    expect(first.body.screenName).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);

    const again = await api.request("POST", "/auth/firebase/register-anonymous", {
      as: "anon-1",
      accountType: "anonymous",
    });
    expect(again.body).toMatchObject({ isNew: false, screenName: first.body.screenName });
  });

  it("GET /me and GET /auth/firebase/me return the same shape", async () => {
    await api.addUser({
      id: "me-1",
      username: "harvey",
      screenName: "ZippyOtter",
      avatar: 4,
      email: "parent@example.com",
      emailVerified: true,
      betaTester: true,
      xpTotal: 120,
      xpProgress: 120,
      streakCurrent: 3,
      streakLongest: 5,
      streakLastDay: "2026-10-08",
      prefs: { sound: false },
      pinHash: "secret-hash",
    });
    const a = await api.request("GET", "/me", { as: "me-1" });
    const b = await api.request("GET", "/auth/firebase/me", { as: "me-1" });
    expect(a.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(a.body.user).toMatchObject({
      userId: "me-1",
      username: "harvey",
      screenName: "ZippyOtter",
      avatar: 4,
      accountType: "username_pin",
      email: "parent@example.com",
      emailVerified: true,
      providers: [],
      preferences: { sound: false },
      betaTester: true,
      admin: false,
      streak: { current: 3, longest: 5, lastDay: "2026-10-08" },
    });
    expect(a.body.user.experience).toMatchObject({ level: 1, total: 120 });
    expect(JSON.stringify(a.body)).not.toContain("secret-hash");

    expect((await api.request("GET", "/me")).status).toBe(401);
    expect((await api.request("GET", "/auth/firebase/me", { as: "no-row" })).status).toBe(404);
    expect((await api.request("GET", "/me", { as: "no-row" })).status).toBe(404);
  });

  it("register-username upgrades an anonymous account; login-username mints a token", async () => {
    await api.request("POST", "/auth/firebase/register-anonymous", {
      as: "kid-1",
      accountType: "anonymous",
    });
    const reg = await api.request("POST", "/auth/firebase/register-username", {
      as: "kid-1",
      accountType: "anonymous",
      body: { username: "Tilly_1", pin: "432100", screenName: "Rocket Star" },
    });
    expect(reg.status).toBe(200);
    expect(reg.body).toEqual({
      ok: true,
      customToken: "custom-token-for-kid-1",
      screenName: "Rocket Star",
      accountType: "username_pin",
    });
    expect(firebase.setUserClaims).toHaveBeenCalledWith("kid-1", {
      accountType: "username_pin",
      username: "tilly_1",
    });
    const row = await getUserById("kid-1");
    expect(row).toMatchObject({ username: "tilly_1", accountType: "username_pin" });
    expect(row?.pinHash).toBeTruthy();
    expect(row?.pinHash).not.toBe("432100");

    // Wrong PIN and unknown username get the same 401.
    const wrong = await api.request("POST", "/auth/firebase/login-username", {
      body: { username: "tilly_1", pin: "000000" },
    });
    const unknown = await api.request("POST", "/auth/firebase/login-username", {
      body: { username: "nobody_here", pin: "432100" },
    });
    expect(wrong).toEqual({ status: 401, body: { error: "That username and PIN don't match" } });
    expect(unknown).toEqual(wrong);

    // Usernames are case-insensitive.
    const ok = await api.request("POST", "/auth/firebase/login-username", {
      body: { username: "TILLY_1", pin: "432100" },
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({
      ok: true,
      customToken: "custom-token-for-kid-1",
      userId: "kid-1",
      screenName: "Rocket Star",
      accountType: "username_pin",
    });
    expect(firebase.createCustomToken).toHaveBeenLastCalledWith("kid-1", {
      accountType: "username_pin",
      username: "tilly_1",
    });
  });

  it("register-username rejects a taken username (any case) and bad input", async () => {
    await api.addUser({ id: "owner", username: "harvey_h" });
    const taken = await api.request("POST", "/auth/firebase/register-username", {
      as: "thief",
      accountType: "anonymous",
      body: { username: "Harvey_H", pin: "123400", screenName: "Someone" },
    });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe("username_taken");
    expect(firebase.createCustomToken).not.toHaveBeenCalled();

    const badPin = await api.request("POST", "/auth/firebase/register-username", {
      as: "thief",
      body: { username: "fine_name", pin: "12" },
    });
    expect(badPin.status).toBe(400);
    const badName = await api.request("POST", "/auth/firebase/register-username", {
      as: "thief",
      body: { username: "no spaces", pin: "123400" },
    });
    expect(badName.status).toBe(400);
  });

  it("register-username refuses a taken screen name", async () => {
    await api.addUser({ id: "first", screenName: "Rocket" });
    const res = await api.request("POST", "/auth/firebase/register-username", {
      as: "second",
      body: { username: "second_kid", pin: "123456", screenName: "rocket" },
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("taken");
  });

  it("change-pin checks the current PIN; admin reset-pin needs an admin", async () => {
    await api.request("POST", "/auth/firebase/register-username", {
      as: "pin-kid",
      body: { username: "pin_kid", pin: "111100", screenName: "Pin Kid" },
    });
    const wrong = await api.request("POST", "/auth/firebase/change-pin", {
      as: "pin-kid",
      body: { currentPin: "999900", newPin: "222200" },
    });
    expect(wrong.status).toBe(401);
    const changed = await api.request("POST", "/auth/firebase/change-pin", {
      as: "pin-kid",
      body: { currentPin: "111100", newPin: "222200" },
    });
    expect(changed).toEqual({ status: 200, body: { ok: true } });

    await api.addUser({ id: "boss", admin: true });
    expect(
      (
        await api.request("POST", "/auth/firebase/admin/reset-pin", {
          as: "pin-kid",
          body: { userId: "pin-kid", newPin: "333300" },
        })
      ).status,
    ).toBe(403);
    const reset = await api.request("POST", "/auth/firebase/admin/reset-pin", {
      as: "boss",
      body: { userId: "pin-kid", newPin: "333300" },
    });
    expect(reset.status).toBe(200);
    const login = await api.request("POST", "/auth/firebase/login-username", {
      body: { username: "pin_kid", pin: "333300" },
    });
    expect(login.status).toBe(200);
  });

  it("link-provider marks the account linked and stores the token's email", async () => {
    const res = await api.request("POST", "/auth/firebase/link-provider", {
      as: "google-kid",
      accountType: "linked",
      email: "family@example.com",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      email: "family@example.com",
      emailVerified: true,
      accountType: "linked",
    });
    expect(await getUserById("google-kid")).toMatchObject({
      accountType: "linked",
      email: "family@example.com",
    });
    expect(firebase.setUserClaims).toHaveBeenCalledWith("google-kid", { accountType: "linked" });
  });

  it("add-email and check-email-verified update the row", async () => {
    await api.addUser({ id: "mail-kid" });
    const added = await api.request("POST", "/auth/firebase/add-email", {
      as: "mail-kid",
      body: { email: "grownup@example.com" },
    });
    expect(added.body).toEqual({ ok: true, email: "grownup@example.com", emailVerified: false });
    expect(firebase.updateFirebaseUserEmail).toHaveBeenCalledWith(
      "mail-kid",
      "grownup@example.com",
    );
    const checked = await api.request("POST", "/auth/firebase/check-email-verified", {
      as: "mail-kid",
    });
    expect(checked.body).toEqual({ ok: true, emailVerified: true });
    expect(await getUserById("mail-kid")).toMatchObject({
      email: "grownup@example.com",
      emailVerified: true,
    });
  });

  it("login-username: 5 wrong PINs in 15 minutes, then 429 (even with the right PIN)", async () => {
    await api.request("POST", "/auth/firebase/register-username", {
      as: "lock-kid",
      body: { username: "lock_kid", pin: "246800", screenName: "Lock Kid" },
    });
    const login = (pin: string, username = "lock_kid") =>
      fetch(`${api.base}/auth/firebase/login-username`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, pin }),
      });

    // A success wipes earlier failures for the username.
    for (let i = 0; i < 4; i++) expect((await login("000000")).status).toBe(401);
    expect((await login("246800")).status).toBe(200);

    for (let i = 0; i < 5; i++) expect((await login("000000", "LOCK_KID")).status).toBe(401);
    const blocked = await login("246800");
    expect(blocked.status).toBe(429);
    const retryAfter = Number(blocked.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(14 * 60);
    expect(retryAfter).toBeLessThanOrEqual(15 * 60);
    expect(await blocked.json()).toMatchObject({ code: "too_many_attempts", retryAfter });

    // The attempts live in Postgres; the IP is only ever a hash.
    const rows = await api.db.select().from(authAttempts);
    expect(rows.filter((r) => r.key === "user:lock_kid" && !r.ok)).toHaveLength(4 + 5);
    expect(rows.filter((r) => r.key === "user:lock_kid" && r.ok)).toHaveLength(1);
    expect(rows.some((r) => r.key.includes("127.0.0.1") || r.key.includes("::1"))).toBe(false);
    expect(rows.some((r) => /^ip:[0-9a-f]{64}$/.test(r.key))).toBe(true);

    // An admin PIN reset lifts the lockout straight away.
    await api.addUser({ id: "reset-boss", admin: true });
    const reset = await api.request("POST", "/auth/firebase/admin/reset-pin", {
      as: "reset-boss",
      body: { userId: "lock-kid", newPin: "864200" },
    });
    expect(reset.status).toBe(200);
    expect((await login("864200")).status).toBe(200);
  });

  it("an unknown username locks the same way, so a 429 says nothing about who exists", async () => {
    const tries = [];
    for (let i = 0; i < 6; i++) {
      tries.push(
        await api.request("POST", "/auth/firebase/login-username", {
          body: { username: "ghost_kid", pin: "123456" },
        }),
      );
    }
    expect(tries.slice(0, 5).every((t) => t.status === 401)).toBe(true);
    expect(tries[5]).toMatchObject({ status: 429, body: { code: "too_many_attempts" } });
  });

  it("the count survives a cold start: it is read from the database, not memory", async () => {
    await api.request("POST", "/auth/firebase/register-username", {
      as: "cold-kid",
      body: { username: "cold_kid", pin: "135790", screenName: "Cold Kid" },
    });
    // Failures recorded by another Lambda container a few minutes ago.
    const at = new Date(Date.now() - 3 * 60 * 1000);
    await api.db
      .insert(authAttempts)
      .values(
        Array.from({ length: 5 }, () => ({ key: "user:cold_kid", ok: false, attemptedAt: at })),
      );
    const res = await api.request("POST", "/auth/firebase/login-username", {
      body: { username: "cold_kid", pin: "135790" },
    });
    expect(res.status).toBe(429);
    expect(res.body.retryAfter).toBeGreaterThan(11 * 60);
    expect(res.body.retryAfter).toBeLessThanOrEqual(12 * 60);

    // Once those failures are older than 15 minutes, the right PIN works again.
    await api.db
      .update(authAttempts)
      .set({ attemptedAt: new Date(Date.now() - 16 * 60 * 1000) })
      .where(eq(authAttempts.key, "user:cold_kid"));
    const later = await api.request("POST", "/auth/firebase/login-username", {
      body: { username: "cold_kid", pin: "135790" },
    });
    expect(later.status).toBe(200);
  });

  it("20 failures from one IP block every username from that IP", async () => {
    await api.request("POST", "/auth/firebase/register-username", {
      as: "ip-kid",
      body: { username: "ip_kid", pin: "112233", screenName: "Ip Kid" },
    });
    for (let i = 0; i < 20; i++) {
      const res = await api.request("POST", "/auth/firebase/login-username", {
        body: { username: `guess_${i}`, pin: "000000" },
      });
      expect(res.status).toBe(401);
    }
    const res = await api.request("POST", "/auth/firebase/login-username", {
      body: { username: "ip_kid", pin: "112233" },
    });
    expect(res.status).toBe(429);
  });

  it("change-pin: 5 wrong current PINs, then 429", async () => {
    await api.request("POST", "/auth/firebase/register-username", {
      as: "pin-lock",
      body: { username: "pin_lock", pin: "102030", screenName: "Pin Lock" },
    });
    for (let i = 0; i < 5; i++) {
      const res = await api.request("POST", "/auth/firebase/change-pin", {
        as: "pin-lock",
        body: { currentPin: "999999", newPin: "405060" },
      });
      expect(res.status).toBe(401);
    }
    const res = await api.request("POST", "/auth/firebase/change-pin", {
      as: "pin-lock",
      body: { currentPin: "102030", newPin: "405060" },
    });
    expect(res.status).toBe(429);
    const bad = await api.request("POST", "/auth/firebase/change-pin", {
      as: "pin-lock",
      body: { currentPin: "102030", newPin: "1234" },
    });
    expect(bad).toMatchObject({ status: 400, body: { error: "New PIN must be 6 digits" } });
  });

  it("DELETE /me removes the account, keeps plays anonymised, and deletes the Firebase user", async () => {
    expect((await api.request("DELETE", "/me")).status).toBe(401);
    await api.request("POST", "/auth/firebase/register-username", {
      as: "bye-kid",
      body: { username: "bye_kid", pin: "121212", screenName: "Bye Kid" },
    });
    await api.addUser({ id: "pal" });
    const [play] = await api.db
      .insert(plays)
      .values({ userId: "bye-kid", gameId: "test-game", score: 42 })
      .returning();
    await api.db
      .insert(bestScores)
      .values({ userId: "bye-kid", gameId: "test-game", score: 42, playId: play!.id });
    await api.db.insert(follows).values({ userId: "pal", targetUserId: "bye-kid" });
    await api.db.insert(userStickers).values({ userId: "bye-kid", stickerId: "week-2026-41" });
    await api.db.insert(authAttempts).values({ key: "user:bye_kid", ok: false });

    const res = await api.request("DELETE", "/me", { as: "bye-kid" });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(firebase.deleteFirebaseUser).toHaveBeenCalledWith("bye-kid");

    expect(await getUserById("bye-kid")).toBeNull();
    const [kept] = await api.db.select().from(plays).where(eq(plays.id, play!.id));
    expect(kept).toMatchObject({ userId: null, score: 42 });
    expect(
      await api.db.select().from(bestScores).where(eq(bestScores.gameId, "test-game")),
    ).toEqual([]);
    expect(await api.db.select().from(follows).where(eq(follows.userId, "pal"))).toEqual([]);
    expect(
      await api.db.select().from(userStickers).where(eq(userStickers.userId, "bye-kid")),
    ).toEqual([]);
    expect(
      await api.db.select().from(authAttempts).where(like(authAttempts.key, "user:bye_kid")),
    ).toEqual([]);
    expect(await getUserById("pal")).not.toBeNull();
  });

  it("DELETE /me keeps everything when Firebase can't delete the user", async () => {
    await api.addUser({ id: "stay-kid" });
    vi.mocked(firebase.deleteFirebaseUser).mockRejectedValueOnce(new Error("firebase down"));
    const res = await api.request("DELETE", "/me", { as: "stay-kid" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("firebase down");
    expect(await getUserById("stay-kid")).not.toBeNull();
  });
});
