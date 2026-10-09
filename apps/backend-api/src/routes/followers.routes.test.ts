import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { follows, presence, userStickers, users } from "../db/schema.js";
import { startTestApp, type TestApp } from "../test/app.js";

const PRIVATE_KEYS = [
  "email",
  "admin",
  "prefs",
  "preferences",
  "lastSeenAt",
  "lastOnline",
  "pinHash",
  "username",
  "gameId",
  "status",
];

function expectNoPrivateFields(value: unknown) {
  const json = JSON.stringify(value);
  for (const key of PRIVATE_KEYS) expect(json, key).not.toContain(`"${key}"`);
  expect(json).not.toContain("@example.com");
}

describe("/followers (friends, T7.6)", () => {
  let api: TestApp;
  const code: Record<string, string> = {};

  async function addPlayer(id: string, extra: Partial<typeof users.$inferInsert> = {}) {
    const row = await api.addUser({ id, screenName: `${id}-pal`, ...extra });
    code[id] = row.friendCode;
    return row;
  }

  const request = (as: string, friendCode: unknown) =>
    api.request("POST", "/followers/request", { as, body: { friendCode } });

  const friendIds = async (as: string) =>
    (await api.request("GET", "/followers/summary", { as })).body.friends.map(
      (f: { userId: string }) => f.userId,
    );

  beforeAll(async () => {
    api = await startTestApp();
    await addPlayer("ana", {
      avatar: 3,
      xpLevel: 4,
      email: "ana@example.com",
      username: "ana",
      admin: true,
      prefs: { theme: "dark" },
      lastSeenAt: new Date(),
    });
    await addPlayer("ben", { avatar: 5, xpLevel: 2 });
    await addPlayer("cat", { email: "cat@example.com" });
    await addPlayer("dan", { disabledAt: new Date() });
    await addPlayer("eve");
    await addPlayer("gus", { accountType: "anonymous" });
  });
  afterAll(() => api.close());

  it("requires sign-in, and a username to send or accept", async () => {
    expect((await api.request("GET", "/followers/summary")).status).toBe(401);
    expect((await api.request("POST", "/followers/request", { body: {} })).status).toBe(401);
    const guest = await api.request("POST", "/followers/request", {
      as: "gus",
      accountType: "anonymous",
      body: { friendCode: code.ana },
    });
    expect(guest).toMatchObject({ status: 403, body: { error: "account_upgrade_required" } });
    const guestAccept = await api.request("POST", "/followers/requests/ana/accept", {
      as: "gus",
      accountType: "anonymous",
    });
    expect(guestAccept.status).toBe(403);
  });

  it("the old instant-follow and public list endpoints are gone", async () => {
    for (const [method, path] of [
      ["POST", "/followers/ben"],
      ["DELETE", "/followers/ben"],
      ["GET", "/followers/followers"],
      ["GET", "/followers/following"],
      ["GET", "/followers/activity"],
      ["GET", "/followers/ids"],
      ["GET", "/followers/notifications"],
    ] as const) {
      expect((await api.request(method, path, { as: "ana" })).status, path).toBe(404);
    }
  });

  it("shows my own friend code", async () => {
    const summary = await api.request("GET", "/followers/summary", { as: "ana" });
    expect(summary.status).toBe(200);
    expect(summary.body).toEqual({
      friendCode: code.ana,
      friends: [],
      incoming: [],
      outgoing: [],
      blocked: [],
    });
    expect(code.ana).toMatch(/^[2-9A-H]{6}$/);
  });

  it("sends a request by code (any case), with no search by name", async () => {
    const sent = await request("ben", ` ${code.ana!.toLowerCase()} `);
    expect(sent).toEqual({ status: 200, body: { ok: true, status: "pending" } });
    const edge = await api.db.select().from(follows).where(eq(follows.userId, "ben"));
    expect(edge).toEqual([expect.objectContaining({ targetUserId: "ana", status: "pending" })]);

    expect(await request("ben", code.ana)).toEqual({
      status: 409,
      body: { error: "request_already_sent" },
    });
    expect(await request("ben", code.ben)).toEqual({
      status: 400,
      body: { error: "cannot_friend_self" },
    });
    expect(await request("ben", "ana-pal")).toEqual({
      status: 400,
      body: { error: "invalid_code" },
    });
    expect(await request("ben", "222222")).toMatchObject({ status: 404 });
    // Disabled players can't send; nobody can reach a disabled player or a guest.
    expect(await request("dan", code.ana)).toEqual({
      status: 403,
      body: { error: "account_disabled" },
    });
    expect(await request("ben", code.dan)).toEqual({
      status: 404,
      body: { error: "code_not_found" },
    });
    expect(await request("ben", code.gus)).toEqual({
      status: 404,
      body: { error: "code_not_found" },
    });
  });

  it("lists pending requests both ways, public fields only", async () => {
    const forAna = await api.request("GET", "/followers/requests", { as: "ana" });
    expect(forAna.body.outgoing).toEqual([]);
    expect(forAna.body.incoming).toEqual([
      {
        userId: "ben",
        screenName: "ben-pal",
        avatar: 5,
        level: 2,
        createdAt: expect.any(String),
      },
    ]);
    const forBen = await api.request("GET", "/followers/summary", { as: "ben" });
    expect(forBen.body.outgoing.map((r: { userId: string }) => r.userId)).toEqual(["ana"]);
    expect(forBen.body.friends).toEqual([]);
    expectNoPrivateFields(forBen.body);
    expect(JSON.stringify(forBen.body)).not.toContain(code.ana);
  });

  it("accepting makes a mutual friendship", async () => {
    expect(await api.request("POST", "/followers/requests/cat/accept", { as: "ana" })).toEqual({
      status: 404,
      body: { error: "request_not_found" },
    });
    expect(await api.request("POST", "/followers/requests/ben/accept", { as: "ana" })).toEqual({
      status: 200,
      body: { ok: true },
    });

    const edges = await api.db.select().from(follows);
    expect(edges.map((e) => [e.userId, e.targetUserId, e.status]).sort()).toEqual([
      ["ana", "ben", "accepted"],
      ["ben", "ana", "accepted"],
    ]);
    const forAna = await api.request("GET", "/followers/summary", { as: "ana" });
    expect(forAna.body.incoming).toEqual([]);
    expect(forAna.body.friends).toEqual([
      {
        userId: "ben",
        screenName: "ben-pal",
        avatar: 5,
        level: 2,
        online: false,
        friendsSince: expect.any(String),
      },
    ]);
    expectNoPrivateFields(forAna.body);
    expect(await friendIds("ben")).toEqual(["ana"]);
    expect(await request("ben", code.ana)).toEqual({
      status: 409,
      body: { error: "already_friends" },
    });
  });

  it("asking someone who already asked you makes you friends", async () => {
    expect((await request("cat", code.eve)).body).toEqual({ ok: true, status: "pending" });
    expect((await request("eve", code.cat)).body).toEqual({ ok: true, status: "friends" });
    expect(await friendIds("cat")).toEqual(["eve"]);
    expect(await friendIds("eve")).toEqual(["cat"]);
  });

  it("declines or cancels a pending request", async () => {
    expect((await request("cat", code.ana)).status).toBe(200);
    expect(await api.request("DELETE", "/followers/requests/cat", { as: "ana" })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect((await api.request("GET", "/followers/requests", { as: "ana" })).body.incoming).toEqual(
      [],
    );
    // The sender can cancel their own, and declining never ends a friendship.
    expect((await request("cat", code.ana)).status).toBe(200);
    await api.request("DELETE", "/followers/requests/ana", { as: "cat" });
    expect((await api.request("GET", "/followers/requests", { as: "cat" })).body.outgoing).toEqual(
      [],
    );
    await api.request("DELETE", "/followers/requests/eve", { as: "cat" });
    expect(await friendIds("cat")).toEqual(["eve"]);
  });

  it("removing a friend ends it for both", async () => {
    expect(await api.request("DELETE", "/followers/friends/eve", { as: "cat" })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(await friendIds("cat")).toEqual([]);
    expect(await friendIds("eve")).toEqual([]);
  });

  it("shares presence only when switched on, and only as online", async () => {
    // Off by default: 204 and nothing stored.
    const off = await api.request("POST", "/followers/status", {
      as: "ben",
      body: { status: "playing", gameId: "test-game" },
    });
    expect(off.status).toBe(204);
    expect(await api.db.select().from(presence).where(eq(presence.userId, "ben"))).toEqual([]);
    expect(
      (await api.request("GET", "/followers/summary", { as: "ana" })).body.friends[0],
    ).toMatchObject({ userId: "ben", online: false });

    await api.db
      .update(users)
      .set({ prefs: { sharePresence: true } })
      .where(eq(users.id, "ben"));
    expect(
      (await api.request("POST", "/followers/status", { as: "ben", body: { status: "playing" } }))
        .status,
    ).toBe(204);
    const [row] = await api.db.select().from(presence).where(eq(presence.userId, "ben"));
    expect(row).toMatchObject({ status: "online", gameId: null });
    const seen = await api.request("GET", "/followers/summary", { as: "ana" });
    expect(seen.body.friends[0]).toMatchObject({ userId: "ben", online: true });
    expectNoPrivateFields(seen.body);

    // Switching it off hides them straight away, even before the row ages out.
    await api.db.update(users).set({ prefs: {} }).where(eq(users.id, "ben"));
    expect(
      (await api.request("GET", "/followers/summary", { as: "ana" })).body.friends[0],
    ).toMatchObject({ online: false });
    await api.request("POST", "/followers/status", { as: "ben" });
    expect(await api.db.select().from(presence).where(eq(presence.userId, "ben"))).toEqual([]);
  });

  it("treats presence older than 2 minutes as offline", async () => {
    await api.db
      .update(users)
      .set({ prefs: { sharePresence: true } })
      .where(eq(users.id, "ben"));
    const old = new Date(Date.now() - 3 * 60 * 1000);
    await api.db.insert(presence).values({ userId: "ben", status: "online", updatedAt: old });
    expect(
      (await api.request("GET", "/followers/summary", { as: "ana" })).body.friends[0],
    ).toMatchObject({ online: false });
  });

  it("public profiles: no lists, friends-since only for friends, stickers newest first", async () => {
    await api.db.insert(userStickers).values([
      { userId: "ben", stickerId: "week-2026-40", earnedAt: new Date("2026-10-01T00:00:00Z") },
      { userId: "ben", stickerId: "week-2026-41", earnedAt: new Date("2026-10-08T00:00:00Z") },
    ]);
    const asFriend = await api.request("GET", "/users/ben", { as: "ana" });
    expect(asFriend.status).toBe(200);
    expect(asFriend.body).toEqual({
      profile: { userId: "ben", screenName: "ben-pal", avatar: 5, level: 2 },
      // friend-made: collected when ana accepted ben (T11.4), so newest.
      stickers: ["friend-made", "week-2026-41", "week-2026-40"],
      isSelf: false,
      friendship: "friends",
      friendsSince: expect.any(String),
    });
    const asStranger = await api.request("GET", "/users/ben", { as: "cat" });
    expect(asStranger.body).toMatchObject({ friendship: "none", friendsSince: null });
    expect(asStranger.body.friendCode).toBeUndefined();
    const json = JSON.stringify(asStranger.body);
    for (const leak of ["follower", "following", "Count", "lastSeen", "online", code.ben!]) {
      expect(json, leak).not.toContain(leak);
    }
  });

  it("the friends leaderboard counts only mutual, unblocked friends", async () => {
    const submit = (as: string, score: number) =>
      api.request("POST", "/scores", { as, body: { gameId: "test-game", score } });
    await submit("ana", 10);
    await submit("ben", 20);
    await submit("cat", 30);
    await submit("eve", 40);
    // eve asked ana (pending) and ana → cat is one-way: neither is a friend.
    await request("eve", code.ana);
    await api.db.insert(follows).values({ userId: "ana", targetUserId: "cat", status: "accepted" });
    const board = await api.request("GET", "/scores/test-game?scope=following", { as: "ana" });
    expect(board.body.map((r: { userId: string }) => r.userId)).toEqual(["ben", "ana"]);
    await api.db.delete(follows).where(eq(follows.userId, "ana"));
    await api.db.insert(follows).values({ userId: "ana", targetUserId: "ben", status: "accepted" });
  });

  it("blocking hides both ways, ends the friendship and stops requests", async () => {
    expect(await api.request("POST", "/followers/block/ana", { as: "ana" })).toEqual({
      status: 400,
      body: { error: "cannot_block_self" },
    });
    expect((await api.request("POST", "/followers/block/nobody", { as: "ana" })).status).toBe(404);
    expect(await api.request("POST", "/followers/block/ben", { as: "ana" })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(await friendIds("ana")).toEqual([]);
    expect(await friendIds("ben")).toEqual([]);
    expect(await api.db.select().from(follows).where(eq(follows.userId, "ben"))).toEqual([]);
    const summary = await api.request("GET", "/followers/summary", { as: "ana" });
    expect(summary.body.blocked).toEqual([{ userId: "ben", screenName: "ben-pal", avatar: 5 }]);
    expect((await api.request("GET", "/followers/summary", { as: "ben" })).body.blocked).toEqual(
      [],
    );

    // Neither side can ask the other, and it looks like an unknown code.
    expect(await request("ben", code.ana)).toEqual({
      status: 404,
      body: { error: "code_not_found" },
    });
    expect(await request("ana", code.ben)).toEqual({
      status: 404,
      body: { error: "code_not_found" },
    });
    // Profiles are hidden both ways; strangers still see them.
    expect((await api.request("GET", "/users/ana", { as: "ben" })).status).toBe(404);
    expect((await api.request("GET", "/users/ben", { as: "ana" })).status).toBe(404);
    expect((await api.request("GET", "/users/ben")).status).toBe(200);
    // Blocking twice is harmless.
    expect((await api.request("POST", "/followers/block/ben", { as: "ana" })).status).toBe(200);
  });

  it("a blocked pair never shares a friends leaderboard, even with stale edges", async () => {
    await api.db.insert(follows).values([
      { userId: "ana", targetUserId: "ben", status: "accepted" },
      { userId: "ben", targetUserId: "ana", status: "accepted" },
    ]);
    const board = await api.request("GET", "/scores/test-game?scope=following", { as: "ana" });
    expect(board.body.map((r: { userId: string }) => r.userId)).toEqual(["ana"]);
    expect(await friendIds("ana")).toEqual([]);
    await api.db.delete(follows).where(eq(follows.userId, "ana"));
    await api.db.delete(follows).where(eq(follows.userId, "ben"));
  });

  it("unblocking lets them ask again but doesn't restore the friendship", async () => {
    // Only the blocker can lift a block.
    await api.request("DELETE", "/followers/block/ana", { as: "ben" });
    expect((await request("ben", code.ana)).status).toBe(404);
    expect(await api.request("DELETE", "/followers/block/ben", { as: "ana" })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(await friendIds("ana")).toEqual([]);
    expect((await request("ben", code.ana)).body).toEqual({ ok: true, status: "pending" });
  });
});
