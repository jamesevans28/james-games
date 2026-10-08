# Phase 6: Backend reset: new Firebase project, Supabase Postgres

Decision: Supabase Postgres as the database, Drizzle ORM for schema and migrations, the existing Express API on Lambda as the only client (service connection through the Supabase connection pooler). Firebase stays for auth, in a **new project** (`games4james`, T6.0). **DynamoDB is not migrated: its code is deleted here and its tables at relaunch** (full reset, DECISIONS 2026-10-09). Cost: $0 on the Supabase free tier.

Free-tier facts to design around (verify on supabase.com/pricing at the time):

- 2 projects, 500 MB database, 1 GB file storage, 5 GB egress, 50k monthly active auth users (unused), 500k edge function invocations.
- **Projects pause after 7 days with no activity.** T6.9 adds a weekly keep-alive. If a project is paused, James restores it from the dashboard with one click.
- No backups on free; T9.6 adds a nightly `pg_dump` to S3 (free tier) via GitHub Actions.

## T6.0 New Firebase project `games4james` (Claude-scripted, MANUAL to finish)

Status: todo
Depends on: nothing (do this first in Phase 6; Phase 7 auth work needs it)
Goal: a clean Firebase project with no trace of flingo, used by local dev from now on and by production at relaunch.
Files: `scripts/firebase-setup.sh` (new), `docs/firebase-auth-setup.md` (rewrite), `apps/player-web/.env.example`, `apps/admin-web/.env.example`, `apps/backend-api/.env.example`
Steps:

1. Claude writes `scripts/firebase-setup.sh`, which does everything the Firebase CLI and Google APIs allow: `firebase projects:create games4james --display-name Games4James` (falls back to `games4james-app` if the id is taken), enable the Identity Toolkit API, `firebase apps:create WEB games4james-web`, print the web config as `.env.local` lines, enable the anonymous provider, set the authorised domains (`localhost`, `games4james.com`, `auth.games4james.com`), and create the service account key for the backend into a gitignored path. It never prints secrets to the terminal beyond the key file path.
2. MANUAL (James): `npm i -g firebase-tools && firebase login`, run the script, then in the console: Authentication → Sign-in method → enable **Google** (pick the support email; this auto-creates the OAuth client) and **Apple** (needs the Services ID from the Apple Developer account, so this one can wait for Phase 10). Google Cloud → OAuth consent screen: app name "Games4James", logo `icon-512.png`, home page and privacy URLs. Everything is listed with exact values in the rewritten `docs/firebase-auth-setup.md`.
3. Put the web config in `apps/player-web/.env.local` and `apps/admin-web/.env.local`, the service account values in `apps/backend-api/.env.local`. GitHub secrets and variables are set at relaunch (T13.4), not now.
4. Claude: the username+PIN flows work unchanged (custom tokens); check anonymous and PIN sign-in locally against the new project. Remove the `migrated` account type and the "re-create your account" copy, since no old accounts exist.
5. Delete the old `apps/backend-api/scripts/*` one-offs that only made sense for the flingo data (`cleanup-dummy-emails.ts`, `migrate-scores.ts`, `add-username-gsi.ts`).
   Done when: `npm run dev` + `npm run server` sign in anonymously and with a new username+PIN against `games4james`; `git grep -n flingo-fun` is empty except DECISIONS and this file; `docs/firebase-auth-setup.md` has no flingo references.

## T6.1 Supabase project (MANUAL, Claude-prepared)

Status: todo
Depends on: T6.0
Goal: a Supabase project exists and Claude has what it needs to connect. One project serves both local development and, from relaunch, production: there is no old data to protect, and local dev stops using it once T13.2 flips it to prod (local then uses pglite or a local Postgres).
MANUAL (James):

1. Create a free account at https://supabase.com (sign in with GitHub). Create an organisation (free plan).
2. New project: name `games4james`, region closest to Australia (`ap-southeast-2` Sydney), a strong database password (store it in your password manager; Claude never needs it in chat).
3. In the project: Settings → Database → Connection string. Copy both the **Transaction pooler** URI (port 6543; for Lambda) and the **Session pooler** URI (port 5432; for migrations). Also Settings → API → Project URL and the `service_role` key (only if T6.10 is ever done; not needed now).
4. Put them locally in `apps/backend-api/.env.local` (gitignored). The GitHub secrets `DATABASE_URL` (transaction pooler, with `?pgbouncer=true`) and `DATABASE_URL_MIGRATIONS` (session pooler) are set at relaunch (T13.2).
5. Settings → General: note the project ref. Authentication is not used (Firebase); leave it default.
   Claude's part: add `DATABASE_URL` and `DATABASE_URL_MIGRATIONS` to `apps/backend-api/.env.example` with comments; add the pooler notes to `apps/backend-api/CLAUDE.md`; add a `scripts/db-ping.mjs` that runs `select 1` so James can confirm connectivity.
   Done when: `node scripts/db-ping.mjs` prints `ok` locally.

## T6.2 Drizzle setup and schema

Status: todo
Depends on: T6.1
Goal: the full schema in code, migrations generated and applied.
Files: `apps/backend-api/src/db/{client,schema}.ts`, `apps/backend-api/drizzle.config.ts`, `apps/backend-api/drizzle/` (migrations), `package.json` scripts
Steps:

1. `npm i drizzle-orm postgres -w apps/backend-api` and `npm i -D drizzle-kit -w apps/backend-api`.
2. `client.ts`: `postgres(DATABASE_URL, { prepare: false, max: 1 })` for Lambda (transaction pooler needs `prepare: false`); export `db = drizzle(sql, { schema })`.
3. Schema (snake_case tables, `timestamptz`, UUIDs where new):
   - `users` (id text PK = Firebase uid, screen_name text unique (citext), screen_name_set_by_user bool, avatar text, account_type enum('anonymous','pin','google','apple'), pin_hash text null, email text null, email_verified bool, admin bool, beta_tester bool, xp_total int, xp_level int, streak_count int, streak_last_day date null, prefs jsonb, created_at, last_seen_at).
   - `games` (id text PK, title, description, status enum('active','beta','inactive'), xp_multiplier numeric, max_score int, max_score_per_second int, metadata jsonb, updated_at).
   - `plays` (id uuid PK, user_id FK, game_id FK, score int, duration_ms int null, xp_awarded int, remix_id uuid null, created_at). Index (game_id, score desc), (user_id, created_at desc).
   - `best_scores` (user_id, game_id, score, play_id, achieved_at) PK(user_id, game_id). Index (game_id, score desc). Maintained by the submission transaction. Leaderboards read this table only.
   - `ratings` (user_id, game_id, stars smallint, created_at, updated_at) PK(user_id, game_id).
   - `follows` (user_id, target_user_id, status enum('pending','accepted'), created_at) PK(user_id, target_user_id). Index (target_user_id).
   - `presence` (user_id PK, game_id null, updated_at). Rows older than 2 minutes are "offline"; a daily cleanup deletes old rows.
   - `user_game_stats` (user_id, game_id, plays int, last_played_at) PK(user_id, game_id).
   - `experience_levels` (level int PK, xp_required int).
   - `screen_name_history` (user_id, old_name, new_name, changed_at) for moderation.
   - `stickers` and `remixes` are added in Phase 11.
4. `drizzle-kit generate` → migration SQL; `drizzle-kit migrate` script `db:migrate` using `DATABASE_URL_MIGRATIONS`.
5. Seed script `db:seed` for `experience_levels` (from `src/data/experienceLevels.ts`) and `games` (from the manifests export).
   Done when: `npm run db:migrate` applies cleanly to the Supabase project; `npm run db:seed` populates levels and games; a Vitest test validates the schema module imports.

## T6.3 Repository layer and services on Postgres

Status: todo
Note (from T1.9): also merge the two current-user endpoints, GET /me and GET /auth/firebase/me, into one response shape and update both frontends.
Depends on: T6.2
Goal: every service reads and writes Postgres; the DynamoDB code is deleted in the same task (no feature flag, no dual path: nothing in production needs the old code, because production is not redeployed until relaunch).
Files: `apps/backend-api/src/repos/*.ts` (new), `services/*.ts`, `config/index.ts`
Steps:

1. One repo per aggregate: `usersRepo`, `gamesRepo`, `playsRepo`, `ratingsRepo`, `followsRepo`, `presenceRepo`, `statsRepo`. Pure data access, typed by Drizzle.
2. Services call repos. Submission is one transaction: insert play → upsert best_scores → update users.xp_total/xp_level (level from `experience_levels`) → update streak → upsert user_game_stats. Returns `{ xpAwarded, newLevel?, newBest: boolean, streak }`.
3. Leaderboards: `select … from best_scores join users … where game_id = $1 order by score desc limit 50`; "friends" variant joins `follows` where status = accepted. Both are single queries.
4. Feed: a single query ranking games by (recent plays, avg rating, updated_at) cached in memory for 60 s per container.
5. Delete the DynamoDB services, `config` table names, the AWS SDK DynamoDB packages and `docs/followers-aws-setup.md` (archive it). Remove the `-- TODO T6.3` lint headers as each file is rewritten.
6. Tests: repos against a local Postgres via `testcontainers` or `pglite` (`@electric-sql/pglite` runs Postgres in-process and is simplest for CI); services with the pglite db.
   Done when: `npm run server` passes a curl script covering every route; `npm test` runs the repo tests against pglite; `git grep -i dynamo apps` is empty.

## T6.4 Migrate data from DynamoDB

Status: dropped (2026-10-09). Full reset: the prototype's data is not kept. The tables are deleted in T13.6.

## T6.5 Remove the old-data shims

Status: todo
Depends on: T6.3
Goal: nothing in the code exists only to read the prototype's data.
Files: `apps/player-web/src/utils/storageKeys.ts`, `platform/storage/bestScore.ts`, `src/config/avatars.ts`, `services/usernamePolicy.ts`, `pages/firebase-login.tsx`, `apps/player-web/src/hooks/useGameCatalog.ts`
Steps:

1. `storageKeys.ts`: drop `LEGACY_STORAGE_KEYS` and `readMigrated` (read the `g4j:` key directly). `bestScore.ts`: drop the legacy-key migration. `avatars.ts`: `avatarFor` no longer wraps old sprite-sheet numbers (invalid → avatar 1). Update the tests.
2. Backend: remove the `migrated` account type and any reclaim logic left from T1.1; PINs are 6 digits for everyone (no "existing 4-digit allowed" path in T7.7).
3. `useGameCatalog`: the server rows no longer carry stale flingo-era titles or thumbnails, so remove the "server rows are stale" workaround and merge server config normally.
   Done when: `git grep -n "flingo\|legacy\|migrated" apps` returns only DECISIONS-style comments or nothing; tests pass.

## T6.6 Server-side scoring from manifests

Status: todo
Depends on: T6.3, T4.8
Goal: `games.max_score`, `max_score_per_second` and `xp_multiplier` come from the manifests export and are enforced in the submission transaction.
Steps: `db:seed` upserts games from `public/game-meta.json` on every deploy (Phase 9 step); submission validates with those values; reject with 400 and a logged event (no PII) when exceeded.
Done when: a test posts an impossible score and gets 400; a normal score passes and awards the expected XP.

## T6.7 Screen names

Status: todo
Depends on: T6.3
Goal: generated by default, editable by the kid, unique, filtered.
Files: `services/screenNameService.ts`, `usersController.ts`, frontend `pages/settings/SettingsScreen.tsx`, `src/platform/names/*`
Steps:

1. Generator: `adjective-animal-NN` from two curated kid-friendly word lists (e.g. "bouncy-otter-42"); assigned on anonymous registration.
2. `PATCH /me/screen-name`: 3–16 chars, letters/digits/space/hyphen, not all digits, no `@`/`.`, case-insensitive unique, rejected if it matches a profanity/slur list or contains a maker's full name pattern, max 3 changes per 30 days. Record in `screen_name_history`.
3. Settings UI: "Your name" field with live availability check and friendly errors ("That one's taken, try another").
4. Admin: list recent name changes; force-reset to a generated name.
   Done when: tests for the validator (good names, bad names, uniqueness); a kid can rename in the Browser pane.

## T6.8 Admin on Postgres

Status: todo
Depends on: T6.3
Steps: replace the table scans with SQL aggregates (daily plays, active users, top games); users search by screen name with pagination; moderation actions (reset name, disable account, delete a play). Keep the admin small.
Done when: dashboard loads under 300 ms locally; moderation actions have tests at the service level.

## T6.9 Keep-alive and housekeeping

Status: todo
Depends on: T6.3 (needed early: the free project pauses after 7 idle days, and it will often be idle before relaunch)
Steps: GitHub Actions cron (weekly) runs `scripts/db-ping.mjs` against `DATABASE_URL` to stop the free-tier pause; a daily cron deletes presence rows older than 1 day and anonymous users with no plays older than 90 days (count logged, no identities).
Done when: both workflows run green once (trigger with `workflow_dispatch`).

## T6.10 Optional later: port the API to Supabase Edge Functions

Status: todo (deferred; decide after Phase 10)
Goal: remove AWS entirely by running the API as a Hono app on Supabase Edge Functions (Deno), keeping Drizzle. Only worth it if AWS becomes a cost or a maintenance burden. Record the decision in `DECISIONS.md` when taken.
