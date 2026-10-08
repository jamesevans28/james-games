import { defineConfig } from "vitest/config";

// One Vitest run for the monorepo (T4.2). Each app is a project with its own
// environment. Coverage targets pure logic; CI enforces the thresholds (Phase 9).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "player-web",
          root: "apps/player-web",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
        },
      },
      {
        test: {
          name: "admin-web",
          root: "apps/admin-web",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          passWithNoTests: true,
        },
      },
      {
        test: {
          name: "backend-api",
          root: "apps/backend-api",
          include: ["src/**/*.test.ts"],
          environment: "node",
          // Each file boots an in-process Postgres (pglite, src/test/db.ts): ~1 s idle, more under load.
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
      {
        test: {
          name: "infra",
          root: "infra",
          include: ["**/*.test.mjs"],
          environment: "node",
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      reportsDirectory: "coverage",
      include: [
        "apps/player-web/src/platform/**",
        "apps/player-web/src/game/**",
        "apps/player-web/src/games/**/useCases/**",
        "apps/player-web/src/utils/**",
        "apps/backend-api/src/services/**",
        "apps/backend-api/src/lib/**",
      ],
      exclude: ["**/*.test.*", "**/*.d.ts"],
      // Per-folder targets from the plan; reported now, enforced by CI in Phase 9.
      thresholds: {
        "apps/player-web/src/platform/**": { lines: 80 },
        // Game use-cases join at 80% as each game is migrated in Phase 5 (T5.x);
        // today only Box Cutter has tests, so a global floor would fail.
      },
    },
  },
});
