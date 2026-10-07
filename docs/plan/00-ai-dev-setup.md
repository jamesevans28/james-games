# Phase 0: AI development setup

Make the repo easy for Claude Code to work in: accurate instructions, one source of truth, scripts that run, docs that aren't stale. Do this first; every later phase gets faster.

## T0.1 Root CLAUDE.md and plan folder
Status: done (2026-10-08, this commit)
Depends on: none
Goal: `CLAUDE.md` at the root points every session at `docs/plan/` and states the conventions.
Done when: `CLAUDE.md`, `docs/plan/README.md`, `docs/plan/DECISIONS.md` and the phase files exist and are committed.

## T0.2 Replace `.github/copilot-instructions.md` with a pointer
Status: done (2026-10-08)
Depends on: T0.1
Goal: one set of instructions. The Copilot file currently duplicates (and partly contradicts) conventions, and embeds a copy of a generic design skill.
Files: `.github/copilot-instructions.md`, `docs/claude-frontend-design.md`
Steps:
1. Rewrite `.github/copilot-instructions.md` to 15 lines: project summary, "read CLAUDE.md and docs/plan/README.md", the four non-negotiables (mobile first, games are plugins, server never trusts client, no PII in logs).
2. Delete `docs/claude-frontend-design.md` (it is a verbatim copy of a generic skill, not project guidance).
3. Remove the "Auth is cookie-based via backend; keep calls using credentials: include" line and any other stale statements (auth is Firebase bearer tokens).
Done when: `grep -ri "cookie-based\|credentials: \"include\"" .github docs` returns nothing; the Copilot file is under 30 lines.

## T0.3 Per-app CLAUDE.md files
Status: done (2026-10-08)
Depends on: T0.1
Goal: each app has a short `CLAUDE.md` with its own commands, structure and gotchas, so sessions scoped to one app have what they need.
Files: `apps/player-web/CLAUDE.md`, `apps/backend-api/CLAUDE.md`, `apps/admin-web/CLAUDE.md`
Steps:
1. player-web: dev/build commands, folder map (`pages/`, `components/`, `hooks/`, `lib/`, `games/`, `platform/` (from Phase 4), `game/`, `utils/`, `config/`), how a game is registered, how to run the Browser pane at phone size, the brand config rule, list of env vars with meaning (no values).
2. backend-api: how to run locally (`npm run server`, needs `.env.local` from `.env.example`), route map, auth model (Firebase ID token → `req.user`), data layer (DynamoDB now, Postgres after Phase 6), the "never trust the client" rule, logging rule.
3. admin-web: purpose (moderation only), commands, note that it must list `firebase` as its own dependency (fix in T1.9).
Done when: all three files exist, each under 80 lines, and nothing in them contradicts the root `CLAUDE.md`.

## T0.4 Fix root scripts and add typecheck/lint/test placeholders
Status: done (2026-10-08)
Depends on: none
Goal: `npm run <x>` at the root works for every app, and the README's command table is correct.
Files: `package.json` (root), `README.md`
Steps:
1. Root `package.json` scripts: `dev`, `server`, `admin:dev`, `web:build`, `admin:build`, `backend:build`, `typecheck` (runs `tsc --noEmit` in each workspace via `npm run typecheck --workspaces --if-present`), `lint` and `test` as `--workspaces --if-present` pass-throughs (the workspaces get real scripts in Phases 1 and 4).
2. Each workspace `package.json`: add `"typecheck": "tsc --noEmit"` (backend already compiles with tsc; use `-p tsconfig.json --noEmit`).
3. README: replace the command table; the README currently references `npm run web:dev` and `backend:dev`, which don't exist (`dev` and `server` do). Remove the stale "Experience & Leveling" API description (it describes the old `{name, gameId, score}` API).
Done when: `npm run typecheck` runs in all three workspaces (it may fail with the 10 known type errors until T1.8; the script itself must run), `npm run dev`, `npm run server`, `npm run admin:dev` each start.

## T0.5 Docs cleanup
Status: done (2026-10-08)
Depends on: none
Goal: `docs/` contains only true documents.
Files: `docs/backend-express-lambda.md`, `docs/user-accounts-aws-setup.md`, `docs/followers-aws-setup.md`, `docs/firebase-auth-setup.md`
Steps:
1. Move `backend-express-lambda.md` and `user-accounts-aws-setup.md` to `docs/archive/` with a one-line banner at the top: "Historical. Describes the Cognito-era design. See docs/plan."
2. Keep `firebase-auth-setup.md`; fix anything that mentions flingo or Cognito.
3. Keep `followers-aws-setup.md` until Phase 6 retires DynamoDB, then archive it (note in T6.8).
4. Add `docs/README.md` listing what each doc is for.
Done when: `grep -ril cognito docs --exclude-dir=archive --exclude-dir=plan` returns nothing.

## T0.6 Claude Code settings and launch configs
Status: todo
Depends on: none
Goal: sessions don't get blocked by permission prompts for routine commands, and the Browser pane can start every app.
Files: `.claude/settings.json`, `.claude/launch.json`
Steps:
1. `.claude/launch.json`: add `backend-api` (`npm run server`, port 8787) and `admin-web` (`npm run admin:dev`, port 3100) alongside `player-web`.
2. `.claude/settings.json`: a permissions allow-list for `npm run *`, `npm test`, `npx vitest*`, `npx tsc*`, `npx eslint*`, `git status/diff/log/add/commit`, `node scripts/*`. Do not allow `git push` or any `aws`/`supabase` write commands by default.
3. Commit both files (they are project config, not personal).
Done when: the files exist and a fresh session can run `npm run typecheck` without a prompt.

## T0.7 Task-prompt and PR templates
Status: done (2026-10-08, this commit)
Depends on: T0.1
Goal: starting a task and reviewing its PR is copy-paste.
Files: `docs/plan/templates/task-session-prompt.md`, `.github/pull_request_template.md`
Steps:
1. Task prompt: the block from `docs/plan/README.md` "How to start a session on a task", plus a reminder to run the Browser pane check for UI tasks.
2. PR template: Task id, Summary, Done-when checklist copied from the task, Screenshots (for UI), "Manual steps for James" section.
Done when: both files exist; the PR template renders on a test PR (can be verified in Phase 9).
