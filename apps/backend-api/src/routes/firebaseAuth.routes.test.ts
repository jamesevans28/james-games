import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestApp, type TestApp } from "../test/app.js";
import { getUserById } from "../repos/usersRepo.js";
import * as firebase from "../services/firebaseAuthService.js";

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
  beforeEach(() => vi.clearAllMocks());

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
    expect(first.body.screenName).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+(#\d{4})?$/);

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
      body: { username: "Tilly_1", pin: "4321", screenName: "Tilly Rocket" },
    });
    expect(reg.status).toBe(200);
    expect(reg.body).toEqual({
      ok: true,
      customToken: "custom-token-for-kid-1",
      screenName: "Tilly Rocket",
      accountType: "username_pin",
    });
    expect(firebase.setUserClaims).toHaveBeenCalledWith("kid-1", {
      accountType: "username_pin",
      username: "tilly_1",
    });
    const row = await getUserById("kid-1");
    expect(row).toMatchObject({ username: "tilly_1", accountType: "username_pin" });
    expect(row?.pinHash).toBeTruthy();
    expect(row?.pinHash).not.toBe("4321");

    // Wrong PIN and unknown username get the same 401.
    const wrong = await api.request("POST", "/auth/firebase/login-username", {
      body: { username: "tilly_1", pin: "0000" },
    });
    const unknown = await api.request("POST", "/auth/firebase/login-username", {
      body: { username: "nobody_here", pin: "4321" },
    });
    expect(wrong).toEqual({ status: 401, body: { error: "Invalid username or PIN" } });
    expect(unknown).toEqual(wrong);

    // Usernames are case-insensitive.
    const ok = await api.request("POST", "/auth/firebase/login-username", {
      body: { username: "TILLY_1", pin: "4321" },
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({
      ok: true,
      customToken: "custom-token-for-kid-1",
      userId: "kid-1",
      screenName: "Tilly Rocket",
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
      body: { username: "Harvey_H", pin: "1234", screenName: "Someone" },
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
      body: { username: "no spaces", pin: "1234" },
    });
    expect(badName.status).toBe(400);
  });

  it("register-username suffixes a taken screen name", async () => {
    await api.addUser({ id: "first", screenName: "Rocket" });
    const res = await api.request("POST", "/auth/firebase/register-username", {
      as: "second",
      body: { username: "second_kid", pin: "123456", screenName: "rocket" },
    });
    expect(res.status).toBe(200);
    expect(res.body.screenName).toMatch(/^rocket#\d{4}$/);
  });

  it("change-pin checks the current PIN; admin reset-pin needs an admin", async () => {
    await api.request("POST", "/auth/firebase/register-username", {
      as: "pin-kid",
      body: { username: "pin_kid", pin: "1111", screenName: "Pin Kid" },
    });
    const wrong = await api.request("POST", "/auth/firebase/change-pin", {
      as: "pin-kid",
      body: { currentPin: "9999", newPin: "2222" },
    });
    expect(wrong.status).toBe(401);
    const changed = await api.request("POST", "/auth/firebase/change-pin", {
      as: "pin-kid",
      body: { currentPin: "1111", newPin: "2222" },
    });
    expect(changed).toEqual({ status: 200, body: { ok: true } });

    await api.addUser({ id: "boss", admin: true });
    expect(
      (
        await api.request("POST", "/auth/firebase/admin/reset-pin", {
          as: "pin-kid",
          body: { userId: "pin-kid", newPin: "3333" },
        })
      ).status,
    ).toBe(403);
    const reset = await api.request("POST", "/auth/firebase/admin/reset-pin", {
      as: "boss",
      body: { userId: "pin-kid", newPin: "3333" },
    });
    expect(reset.status).toBe(200);
    const login = await api.request("POST", "/auth/firebase/login-username", {
      body: { username: "pin_kid", pin: "3333" },
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
});
