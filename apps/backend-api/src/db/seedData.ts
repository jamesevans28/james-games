import { sql } from "drizzle-orm";
import { DEFAULT_EXPERIENCE_LEVELS } from "../data/experienceLevels.js";
import type { Db } from "./client.js";
import { experienceLevels, games } from "./schema.js";

/** The fields the backend needs from a game manifest (apps/player-web/public/game-meta.json). */
export type ManifestRow = {
  id: string;
  title: string;
  tagline?: string;
  status: "active" | "beta" | "inactive";
  scoring: { max: number; perSecondMax: number; xpMultiplier: number };
};

/**
 * Upserts every game from the exported manifests and the XP level table. Idempotent:
 * run on every deploy. Manifests own title, status and scoring; admin-managed
 * `metadata` is never touched.
 */
export async function seedDatabase(db: Db, manifests: ManifestRow[]): Promise<void> {
  if (manifests.length) {
    await db
      .insert(games)
      .values(
        manifests.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.tagline ?? null,
          status: m.status,
          xpMultiplier: m.scoring.xpMultiplier,
          maxScore: m.scoring.max,
          maxScorePerSecond: m.scoring.perSecondMax,
        })),
      )
      .onConflictDoUpdate({
        target: games.id,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          status: sql`excluded.status`,
          xpMultiplier: sql`excluded.xp_multiplier`,
          maxScore: sql`excluded.max_score`,
          maxScorePerSecond: sql`excluded.max_score_per_second`,
          updatedAt: sql`now()`,
        },
      });
  }
  await db
    .insert(experienceLevels)
    .values(DEFAULT_EXPERIENCE_LEVELS)
    .onConflictDoUpdate({
      target: experienceLevels.level,
      set: {
        requiredXp: sql`excluded.required_xp`,
        cumulativeXp: sql`excluded.cumulative_xp`,
      },
    });
}
