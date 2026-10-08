# Games4James — Claude Code guide

Games4James is a mobile-first web platform of small Phaser games made by James with his kids Tilly and Harvey. This repo is being revived from a January 2026 prototype. **All development is done with Claude Code.** Work is organised as a phased implementation plan that every session should read first.

## Start here, every session

1. Read `docs/plan/README.md` (the master plan and status board).
2. Read `docs/plan/DECISIONS.md` (decisions already made; do not re-litigate them).
3. Pick the next `todo` task in the lowest unfinished phase unless the user names one.
4. Work the task exactly as its file describes: Goal → Steps → Done when. Run the verification commands.
5. When a task is done, update its `Status:` line and the status table in `docs/plan/README.md`, then commit with the task id in the message (for example `feat(sdk): T4.3 BasePlatformScene`).

Do not start a later phase's task while an earlier phase has a `todo` task that it depends on. Each task file lists dependencies.

## Repo layout

```
apps/player-web/   React 19 + Vite + Tailwind 4 + Phaser PWA (the product)
apps/backend-api/  Express API on AWS Lambda (data layer moving to Supabase Postgres, see Phase 6)
apps/admin-web/    React admin console (keep minimal; moderation only)
docs/plan/         The implementation plan. Source of truth for what to do next.
docs/              Setup notes. Anything that contradicts docs/plan is stale.
scripts/           Repo-level build/asset scripts (SEO files, brand icons, codemods)
infra/             Hand-attached cloud pieces (CloudFront Functions) with tests and MANUAL steps
.github/workflows/ CI/CD
```

## Commands

```bash
npm install                 # once, at the repo root (npm workspaces)
npm run dev                 # player web on http://localhost:3000
npm run server              # backend API on http://localhost:8787
npm run admin:dev           # admin on http://localhost:3100
npm run web:build           # production build of player web
npm run lint                # ESLint (one root eslint.config.mjs); 0 errors required
npm run format              # Prettier; `format:check` must pass
npm run typecheck           # tsc --noEmit across workspaces
npm test                    # Vitest, all projects (root vitest.config.ts); test:coverage for coverage
```

The Browser pane launch config is `.claude/launch.json` (`player-web`). Use a 375×812 viewport when checking UI.

## Conventions

- **Mobile first.** Portrait, touch first, 540×960 design resolution, 60 fps.
- **Games are plugins.** A game is a folder under `apps/player-web/src/games/<id>/` with a `manifest.ts` and a `create(host, el)` entry (Phase 4 SDK). Game logic lives in pure functions; Phaser only in `scenes/` and `adapters/`.
- **Shared code goes in `apps/player-web/src/platform/`** (SDK, HUD, input, audio, storage) and `apps/player-web/src/game/` (Phaser-agnostic helpers). If you write the same thing twice, extract it.
- **The server never trusts the client** for scores, XP, dates or multipliers.
- **No PII in logs.** Never log emails, usernames, user ids, or raw error objects from auth libraries.
- **Brand strings come from `apps/player-web/src/config/brand.ts`.** Never hard-code "games4james", URLs, colours or analytics ids elsewhere.
- **Kid safety is the default.** Social features are friends-only, screen names are filtered, nothing public without an opt-in.
- **Tests for pure logic** (`*.test.ts` next to the file, Vitest). UI is checked manually in the Browser pane.
- TypeScript strict, no `any` in new code, no `@ts-ignore` without a comment explaining why.
- Lint must pass with 0 errors. Legacy files carry a file-level `eslint-disable … -- TODO T5.x/T6.x` header; remove it when you migrate that file, never add new ones. Games may not import `utils/gameEvents` or touch `localStorage`/`window.location` (use the host).
- Test files use `import { test, expect } from "vitest"`; stub globals with `vi.stubGlobal`.
- Commit messages: `type(scope): T<phase>.<n> short description`. End with the attribution line the session provides.

## Things that are deliberately gone or changing

- `flingo.fun` is dead. The brand is Games4James at https://games4james.com (API at https://api.games4james.com).
- "Word Rush with Tom": Tom was a placeholder. The kids are Tilly and Harvey.
- DynamoDB is being replaced by Supabase Postgres (Phase 6) with **no data migration**: this is a full reset for the summer 2026/27 relaunch (Phase 13). Do not add DynamoDB code, and do not write shims that carry prototype data forward.
- The Firebase project `flingo-fun` is replaced by `games4james` (T6.0). Don't configure the old one.
- Deploys stay manual until relaunch (Phase 13). Never run the deploy workflow unless James asks.
- Cognito is gone. Auth is Firebase (anonymous, username + PIN, Google, Apple).
- Cut games (Car Crash, Block Breaker, Ready Steady Shoot, Fill the Cup, Ho Ho Home Delivery) are set `inactive`, not deleted (Phase 5).

## When unsure

Prefer the smallest change that completes the task's "Done when". Record new decisions in `docs/plan/DECISIONS.md` with a date. Ask the user only when two readings of a task would produce materially different work.
