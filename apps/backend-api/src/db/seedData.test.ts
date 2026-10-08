import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb, TEST_GAMES } from "../test/db.js";
import { seedDatabase } from "./seedData.js";
import { experienceLevels, games } from "./schema.js";

describe("seedDatabase", () => {
  it("loads games and XP levels, and is safe to run twice", async () => {
    const db = await createTestDb();
    await db
      .update(games)
      .set({ metadata: { badge: "new" } })
      .where(eq(games.id, "test-game"));
    await seedDatabase(db, [{ ...TEST_GAMES[0]!, title: "Renamed", status: "inactive" }]);

    const rows = await db.select().from(games).orderBy(games.id);
    expect(rows.map((r) => r.id)).toEqual(["beta-game", "old-game", "test-game"]);
    const game = rows.find((r) => r.id === "test-game");
    expect(game).toMatchObject({
      title: "Renamed",
      status: "inactive",
      metadata: { badge: "new" },
    });

    const levels = await db.select().from(experienceLevels);
    expect(levels).toHaveLength(100);
  });
});
