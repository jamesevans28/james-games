# Games4James revival: implementation plan

**Owner:** James. **Makers credited on the site:** James, Tilly and Harvey.
**Built by:** Claude Code, phase by phase, task by task.
**Review this plan is based on:** https://claude.ai/artifact/4DpSaFfrHPV9hgo9pTHNHz (8 Oct 2026).

## Goals

1. Make the existing web app safe, current and correct, and relaunch it as **games4james.com**.
2. Give the platform a real core (a Game SDK, SQL data layer, tests, CI) so every improvement reaches every game.
3. Put the kids at the front: credits, designer's notes, AI-generated "kids art" style, remixable games.
4. Lay the groundwork for App Store and Play Store builds with Capacitor, without blocking the web relaunch.
5. Spend nothing: free tiers only (AWS free tier, Supabase free, GitHub Actions free, Firebase Spark).

## Principles for working this plan

- **One task per session, start to finish.** A task is sized so one Claude Code session can finish it, verify it and commit it.
- **Phases are ordered; tasks inside a phase are ordered unless marked `parallel-ok`.** Dependencies are listed per task.
- **Every task has a "Done when" with commands.** Do not mark a task done without running them.
- **Update status in two places:** the `Status:` line in the task, and the table below.
- **Record decisions** in `DECISIONS.md`. Do not reopen decided questions.
- **Manual steps are labelled `MANUAL (James)`.** Claude prepares everything around them and tells James exactly what to click.
- **Nothing is deleted that might be wanted later** (games go `inactive`; old assets move to `archive/`), except dead code and secrets handling.

## Phase index and status

| Phase | File | Purpose | Status |
|---|---|---|---|
| 0 | [00-ai-dev-setup.md](00-ai-dev-setup.md) | Claude/AI development setup: instructions, scripts, docs cleanup | done (2026-10-08) |
| 1 | [01-security-and-hygiene.md](01-security-and-hygiene.md) | Close the P0 security holes, fix known bugs, delete dead code, typecheck gate | done (2026-10-08) |
| 2 | [02-dependency-upgrade.md](02-dependency-upgrade.md) | Node 24, latest of everything, Phaser 4, Express 5, Vite 8, Tailwind 4.3 | done (2026-10-08; MANUAL: install Node 24 locally, try PIN + Google sign-in once) |
| 3 | [03-rebrand-and-seo.md](03-rebrand-and-seo.md) | Games4James brand, domain, Firebase auth domain, icons, SEO, prerender | in-progress (T3.1–T3.4 done; MANUAL: attach CloudFront Function) |
| 4 | [04-game-sdk-lint-tests.md](04-game-sdk-lint-tests.md) | Game SDK, manifests, base scene, HUD/input/audio kits, ESLint, Vitest | todo |
| 5 | [05-games-polish-and-inactive.md](05-games-polish-and-inactive.md) | Inactive flag for cut games, migrate and polish the keepers | todo |
| 6 | [06-sql-data-layer-supabase.md](06-sql-data-layer-supabase.md) | Supabase Postgres + Drizzle, migrate from DynamoDB, server-side scoring | todo |
| 7 | [07-ux-and-kid-safety.md](07-ux-and-kid-safety.md) | Home grid, game-over, screen names, friends-only social, privacy/parent pages | todo |
| 8 | [08-art-pipeline-ai.md](08-art-pipeline-ai.md) | AI-generated "kids art" style bible, prompts, covers, sprites, avatars, sounds | todo |
| 9 | [09-cicd.md](09-cicd.md) | Gated, path-filtered pipelines; auto-deploy web, admin, API, DB migrations | todo |
| 10 | [10-capacitor.md](10-capacitor.md) | Capacitor groundwork, native auth, store accounts, first builds | todo |
| 11 | [11-features-and-growth.md](11-features-and-growth.md) | Credits, remix mode, daily challenge, stickers, share cards, new games | todo |

Status values: `todo`, `in-progress`, `done`, `blocked (reason)`.

## Suggested order of sessions

Phases 0 → 1 → 2 → 3 get the web app safe, current and correctly branded (the relaunch). Phase 9 (CI/CD) can be started right after Phase 1 and finished after Phase 6. Phase 4 → 5 → 6 → 7 → 8 build the platform. Phase 10 groundwork tasks (`T10.1`–`T10.3`) can run any time after Phase 4; store submission waits until Phase 7 is done. Phase 11 is ongoing.

## How to start a session on a task

Paste this to Claude Code:

```
Read CLAUDE.md and docs/plan/README.md. Work task T<phase>.<n> from docs/plan/<file>.
Follow its Steps, run its "Done when" checks, update its Status line and the README status table, and commit.
Stop and ask me only for the MANUAL steps.
```

## Task format

Each task in a phase file looks like:

```
### T<phase>.<n> Title
Status: todo
Depends on: T.. (or none)
Goal: one sentence.
Files: the files to read and change.
Steps: numbered, concrete.
Done when: acceptance checks with commands.
Notes: risks, alternatives, references.
```

## Environment facts (verified 8 Oct 2026)

- games4james.com and api.games4james.com are live (S3/CloudFront + Lambda). flingo.fun no longer resolves.
- Live API still answers; leaderboards have 5–12 distinct players per game with scores through Sept 2026. Preserve this data when migrating (Phase 6).
- Firebase project id is `flingo-fun` (keep it; use a custom auth domain, Phase 3).
- GA4 property `G-8EJGYV0500` (keep or replace, Phase 7).
- Node on James's Mac: 22.14 at time of writing; target Node 24 LTS (Phase 2).
- Latest package versions at time of writing are listed in Phase 2.
