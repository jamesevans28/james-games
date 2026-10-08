import { describe, expect, it } from "vitest";
import { createTestDb } from "../test/db.js";
import { runHousekeeping } from "./housekeeping.js";
import { plays, presence, users } from "./schema.js";

describe("runHousekeeping", () => {
  it("removes stale presence and idle guests with no plays, nothing else", async () => {
    const db = await createTestDb();
    const now = new Date("2026-10-09T00:00:00Z");
    const old = new Date("2026-06-01T00:00:00Z");
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

    expect(await runHousekeeping(db, now)).toEqual({ presenceDeleted: 1, guestsDeleted: 1 });
    const left = await db.select({ id: users.id }).from(users).orderBy(users.id);
    expect(left.map((u) => u.id)).toEqual(["guest-who-played", "new-guest", "old-kid"]);
  });
});
