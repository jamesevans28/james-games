# Games4James revival: implementation plan

**Owner:** James. **Makers credited on the site:** James, Tilly and Harvey.
**Built by:** Claude Code, phase by phase, task by task.
**Review this plan is based on:** https://claude.ai/artifact/4DpSaFfrHPV9hgo9pTHNHz (8 Oct 2026).

## The reset (decided 9 Oct 2026)

Nobody is using the site, so this is a **full reset for a summer 2026/27 relaunch** (target: the first week of December 2026, before the school holidays). Nothing from the prototype's data survives: no DynamoDB migration, a new Firebase project, fresh accounts and leaderboards. The live site keeps serving the old build untouched until relaunch day; there is no "coming soon" page and no deploying of half-finished work. Every task should be something we keep; if a step exists only to carry the old prototype forward, it is gone from this plan.

## Goals

1. Relaunch **games4james.com** as a finished product: safe, current, kid-safe, in the new look, with the keeper games polished.
2. Give the platform a real core (Game SDK, SQL data layer, tests, CI) so every improvement reaches every game.
3. Put the kids at the front: credits, designer's notes, AI-generated "kids art" style, remixable games.
4. Ship the App Store and Play Store builds with Capacitor soon after the web relaunch.
5. Make it pay for itself without ads: a support page at relaunch, cosmetic supporter perks after, in-app purchases in the store apps (Phase 12).
6. Spend nothing until it earns: free tiers only (AWS free tier, Supabase free, GitHub Actions free, Firebase Spark). The only planned spend is the store developer accounts when Phase 10 needs them.

## Principles for working this plan

- **One task per session, start to finish.** A task is sized so one Claude Code session can finish it, verify it and commit it.
- **Phases are ordered; tasks inside a phase are ordered unless marked `parallel-ok`.** Dependencies are listed per task.
- **Every task has a "Done when" with commands.** Do not mark a task done without running them.
- **Update status in two places:** the `Status:` line in the task, and the table below.
- **Record decisions** in `DECISIONS.md`. Do not reopen decided questions.
- **Manual steps are labelled `MANUAL (James)`.** Claude prepares everything around them and tells James exactly what to click.
- **Nothing is deleted that might be wanted later** (games go `inactive`; old assets move to `archive/`), except dead code and secrets handling.

## Phase index and status

| Phase | File                                                               | Purpose                                                                                  | Status                                                                                                                           |
| ----- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0     | [00-ai-dev-setup.md](00-ai-dev-setup.md)                           | Claude/AI development setup: instructions, scripts, docs cleanup                         | done (2026-10-08)                                                                                                                |
| 1     | [01-security-and-hygiene.md](01-security-and-hygiene.md)           | Close the P0 security holes, fix known bugs, delete dead code, typecheck gate            | done (2026-10-08)                                                                                                                |
| 2     | [02-dependency-upgrade.md](02-dependency-upgrade.md)               | Node 24, latest of everything, Phaser 4, Express 5, Vite 8, Tailwind 4.3                 | done (2026-10-08; MANUAL: install Node 24 locally, try PIN + Google sign-in once)                                                |
| 3     | [03-rebrand-and-seo.md](03-rebrand-and-seo.md)                     | Games4James brand, domain, Firebase auth domain, icons, SEO, prerender                   | done (2026-10-08; T3.5 and T3.6 moved to Phase 13)                                                                               |
| 4     | [04-game-sdk-lint-tests.md](04-game-sdk-lint-tests.md)             | Game SDK, manifests, base scene, HUD/input/audio kits, ESLint, Vitest                    | done (2026-10-08; Stack Tower added as a beta example game)                                                                      |
| 5     | [05-games-polish-and-inactive.md](05-games-polish-and-inactive.md) | Inactive flag for cut games, migrate and polish the keepers                              | done (2026-10-09)                                                                                                                |
| 6     | [06-sql-data-layer-supabase.md](06-sql-data-layer-supabase.md)     | New Firebase project, Supabase Postgres + Drizzle, DynamoDB removed, server-side scoring | done in code (2026-10-09); MANUAL: T6.0 Firebase, T6.1 Supabase, DB secrets                                                      |
| 7     | [07-ux-and-kid-safety.md](07-ux-and-kid-safety.md)                 | Home grid, game-over, screen names, friends-only social, privacy/parent pages            | done (2026-10-09; MANUAL: Cloudflare analytics token, contact email)                                                             |
| 8     | [08-art-pipeline-ai.md](08-art-pipeline-ai.md)                     | AI-generated "kids art" style bible, prompts, covers, sprites, avatars, sounds           | in-progress (T8.1–T8.3, T8.9 tooling done; the art itself needs James or an image API key)                                       |
| 9     | [09-cicd.md](09-cicd.md)                                           | Gated, path-filtered pipelines; auto-deploy web, admin, API, DB migrations               | done in code (T9.1–T9.7; MANUAL: branch protection, backup bucket; T9.8 with Phase 10, T9.9 later)                               |
| 10    | [10-capacitor.md](10-capacitor.md)                                 | Capacitor groundwork, native auth, store accounts, first builds                          | in-progress (T10.1–T10.7 done in code; MANUAL: Xcode/Android Studio, Firebase native apps, store accounts; T10.8 first releases) |
| 11    | [11-features-and-growth.md](11-features-and-growth.md)             | Credits, remix mode, daily challenge, stickers, share cards, new games                   | done in code (T11.1–T11.8, T11.10; Colour Sort beta; notes are drafts for James; T11.9 on demand; T11.11 idea)                   |
| 12    | [12-money.md](12-money.md)                                         | Support page, supporter perks, in-app purchases, no ads, cost hygiene                    | done in code (T12.1–T12.3, T12.5; MANUAL: Ko-fi, Stripe, RevenueCat, AWS budget; T12.4 optional)                                 |
| 13    | [13-relaunch.md](13-relaunch.md)                                   | Production cutover: new backend live, deploys on, old project and tables deleted, checks | ready (pre-flight green 2026-10-09; runbook in docs/relaunch-log.md; blocked on Phase 8 art and James's cloud setup)             |

Status values: `todo`, `in-progress`, `done`, `blocked (reason)`.

## Suggested order of sessions

Phases 0–4 are done. The path to relaunch is **5 → 6 → 9 (T9.1–T9.3) → 7 → 8 → 12 (T12.1 only) → 13**. Phase 6 starts with the new Firebase project (T6.0) because Phase 7's auth work builds on it. Phase 10 groundwork (`T10.1`–`T10.3`) can run after Phase 7; store submission and the rest of Phase 12 come after the web relaunch. Phase 11 is ongoing and should not delay Phase 13.

Rough budget to the first week of December 2026: Phase 5 two weeks, Phase 6 one week, Phase 9 (first three tasks) two days, Phase 7 two weeks, Phase 8 one week (the AI generation is James's time), Phase 13 two days. If it slips, cut from Phase 11 and Phase 10, never from Phase 7.

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
- The live API still answers, with 5–12 players per game through Sept 2026. **This data is not kept** (full reset, 9 Oct 2026). The DynamoDB tables are deleted in Phase 13.
- Firebase project `flingo-fun` is the prototype's; it is replaced by a new `games4james` project in T6.0 and deleted in Phase 13.
- Analytics is Cloudflare Web Analytics (cookieless, T7.9); the old GA4 property `G-8EJGYV0500` is no longer loaded and can be deleted.
- Deploys stay manual (`workflow_dispatch`) until Phase 13 turns auto-deploy on.
- Node on James's Mac: 22.14 at time of writing; target Node 24 LTS (Phase 2).
- Latest package versions at time of writing are listed in Phase 2.
