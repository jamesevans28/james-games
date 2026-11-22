import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../test/db.js";
import { fakeAuthAdmin } from "../test/app.js";
import { setAuthAdminForTests } from "../services/supabaseAuthService.js";
import {
  AUTH_DELETE_CAP,
  AUTH_MAX_PAGES,
  AUTH_PAGE_SIZE,
  runHousekeeping,
} from "./housekeeping.js";
import { authAttempts, plays, presence, users } from "./schema.js";

const now = new Date("2026-10-09T00:00:00Z");
const old = new Date("2026-06-01T00:00:00Z");

let authAdmin: ReturnType<typeof fakeAuthAdmin>;
beforeEach(() => {
  authAdmin = fakeAuthAdmin();
  setAuthAdminForTests(authAdmin.admin);
});
afterEach(() => setAuthAdminForTests(null));

function authUser(id: string, isAnonymous: boolean, createdAt: Date, lastSignInAt?: Date) {
  return { id, isAnonymous, createdAt, lastSignInAt: lastSignInAt ?? null };
}

describe("runHousekeeping", () => {
  it("removes stale presence and idle guests with no plays, nothing else", async () => {
    const db = await createTestDb();
    await db.insert(users).values([
      { id: "idle-guest", screenName: "a", accountType: "anonymous", createdAt: old },
      { id: "guest-who-played", screenName: "b", accountType: "anonymous", createdAt: old },
      { id: "new-guest", screenName: "c", accountType: "anonymous", createdAt: now },
      { id: "old-kid", screenName: "d", accountType: "username_pin", createdAt: old },
    ]);
    await db.insert(plays).values({ userId: "guest-who-played", gameId: "test-game", score: 5 });
    await db.insert(presence).values([
      { userId: "old-kid", status: "home", updatedAt: old },
      { userId: "new-guest", status: "home", updatedAt: now },
    ]);

    await db.insert(authAttempts).values([
      { key: "user:old", attemptedAt: old },
      { key: "user:new", attemptedAt: now },
    ]);
    expect(await runHousekeeping(db, now)).toEqual({
      presenceDeleted: 1,
      attemptsDeleted: 1,
      guestsDeleted: 1,
      authSweep: "complete",
      guestAuthUsersDeleted: 0,
      orphanAuthUsersDeleted: 0,
      authDeleteFailures: 0,
      authUsersLeft: 0,
    });
    const left = await db.select({ id: users.id }).from(users).orderBy(users.id);
    expect(left.map((u) => u.id)).toEqual(["guest-who-played", "new-guest", "old-kid"]);
  });

  it("deletes the auth users of deleted guests and of idle anonymous users with no row", async () => {
    const db = await createTestDb();
    await db.insert(users).values([
      { id: "idle-guest", screenName: "a", accountType: "anonymous", createdAt: old },
      { id: "idle-guest-gone", screenName: "b", accountType: "anonymous", createdAt: old },
      { id: "idle-guest-upgraded", screenName: "c", accountType: "anonymous", createdAt: old },
      { id: "guest-who-played", screenName: "d", accountType: "anonymous", createdAt: old },
    ]);
    await db.insert(plays).values({ userId: "guest-who-played", gameId: "test-game", score: 5 });
    authAdmin.authUsers.push(
      // Its row is deleted this run: removed whatever its auth timestamps say.
      authUser("idle-guest", true, old, now),
      // Not anonymous in Supabase: kept even though its row went.
      authUser("idle-guest-upgraded", false, old),
      // Has a row: kept.
      authUser("guest-who-played", true, old),
      // Never registered and idle: removed.
      authUser("left-before-register", true, old),
      // Never registered but signed in recently, or new: kept.
      authUser("came-back", true, old, now),
      authUser("just-arrived", true, now),
      // A PIN or Google account with no row is never ours to remove here.
      authUser("old-pin-no-row", false, old),
    );

    expect(await runHousekeeping(db, now)).toMatchObject({
      guestsDeleted: 3,
      authSweep: "complete",
      guestAuthUsersDeleted: 1,
      orphanAuthUsersDeleted: 1,
      authDeleteFailures: 0,
      authUsersLeft: 0,
    });
    // Guests first, then orphans; "idle-guest-gone" isn't listed, so it's already gone.
    expect(authAdmin.callsTo("deleteAuthUser")).toEqual([["idle-guest"], ["left-before-register"]]);
    expect(authAdmin.callsTo("listUsers")).toEqual([[1, AUTH_PAGE_SIZE]]);
  });

  it("keeps going past a failed delete and still cleans the database when listing fails", async () => {
    const db = await createTestDb();
    authAdmin.authUsers.push(authUser("orphan-1", true, old), authUser("orphan-2", true, old));
    authAdmin.failNext("deleteAuthUser");
    expect(await runHousekeeping(db, now)).toMatchObject({
      orphanAuthUsersDeleted: 1,
      authDeleteFailures: 1,
    });

    await db
      .insert(users)
      .values({ id: "idle-guest", screenName: "a", accountType: "anonymous", createdAt: old });
    authAdmin.failNext("listUsers");
    expect(await runHousekeeping(db, now)).toEqual({
      presenceDeleted: 0,
      attemptsDeleted: 0,
      guestsDeleted: 1,
      authSweep: "failed",
    });
  });

  it("pages through the list, then deletes at most the cap per run", async () => {
    const db = await createTestDb();
    for (let i = 0; i < AUTH_PAGE_SIZE + AUTH_DELETE_CAP; i++) {
      authAdmin.authUsers.push(authUser(`orphan-${i}`, true, old));
    }
    const result = await runHousekeeping(db, now);
    // The row lookup stops once a chunk fills the cap, so what's left is a lower bound.
    expect(result).toMatchObject({
      authSweep: "complete",
      orphanAuthUsersDeleted: AUTH_DELETE_CAP,
      authUsersLeft: AUTH_PAGE_SIZE - AUTH_DELETE_CAP,
    });
    expect(authAdmin.callsTo("listUsers")).toEqual([
      [1, AUTH_PAGE_SIZE],
      [2, AUTH_PAGE_SIZE],
    ]);
    expect(authAdmin.callsTo("deleteAuthUser")).toHaveLength(AUTH_DELETE_CAP);
  });

  it("says the list was cut short when it reaches the page limit", async () => {
    const db = await createTestDb();
    for (let i = 0; i < AUTH_PAGE_SIZE * AUTH_MAX_PAGES; i++) {
      authAdmin.authUsers.push(authUser(`user-${i}`, false, old));
    }
    expect(await runHousekeeping(db, now)).toMatchObject({ authSweep: "truncated" });
    expect(authAdmin.callsTo("listUsers")).toHaveLength(AUTH_MAX_PAGES);
    expect(authAdmin.callsTo("deleteAuthUser")).toEqual([]);
  });

  it("skips Supabase entirely when asked", async () => {
    const db = await createTestDb();
    authAdmin.authUsers.push(authUser("orphan", true, old));
    expect(await runHousekeeping(db, now, { sweepAuthUsers: false })).toMatchObject({
      authSweep: "skipped",
    });
    expect(authAdmin.calls).toEqual([]);
  });
});
