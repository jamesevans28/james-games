# Phase 6: SQL data layer on Supabase (free tier)

Decision: Supabase Postgres as the database, Drizzle ORM for schema and migrations, the existing Express API on Lambda as the only client (service connection through the Supabase connection pooler). Firebase stays for auth. DynamoDB is migrated and then retired. Cost: $0 on the Supabase free tier.

Free-tier facts to design around (verify on supabase.com/pricing at the time):
- 2 projects, 500 MB database, 1 GB file storage, 5 GB egress, 50k monthly active auth users (unused), 500k edge function invocations.
- **Projects pause after 7 days with no activity.** T6.9 adds a weekly keep-alive. If a project is paused, James restores it from the dashboard with one click.
- No backups on free; T9.6 adds a nightly `pg_dump` to S3 (free tier) via GitHub Actions.

## T6.1 Supabase project (MANUAL, Claude-prepared)
Status: todo
Depends on: Phase 1 complete (Phase 2–5 may be in progress; this task is independent)
Goal: a Supabase project exists and Claude has what it needs to connect.
MANUAL (James):
1. Create a free account at https://supabase.com (sign in with GitHub). Create an organisation (free plan).
2. New project: name `games4james`, region closest to Australia (`ap-southeast-2` Sydney), a strong database password (store it in your password manager; Claude never needs it in chat).
3. In the project: Settings → Database → Connection string. Copy both the **Transaction pooler** URI (port 6543; for Lambda) and the **Session pooler** URI (port 5432; for migrations). Also Settings → API → Project URL and the `service_role` key (only if T6.10 is ever done; not needed now).
4. Put them in GitHub repo secrets as `DATABASE_URL` (transaction pooler, with `?pgbouncer=true`) and `DATABASE_URL_MIGRATIONS` (session pooler), and locally in `apps/backend-api/.env.local` (gitignored).
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
Goal: every service reads and writes Postgres; DynamoDB code is behind a feature flag until cut-over.
Files: `apps/backend-api/src/repos/*.ts` (new), `services/*.ts`, `config/index.ts`
Steps:
1. One repo per aggregate: `usersRepo`, `gamesRepo`, `playsRepo`, `ratingsRepo`, `followsRepo`, `presenceRepo`, `statsRepo`. Pure data access, typed by Drizzle.
2. Services call repos. Submission is one transaction: insert play → upsert best_scores → update users.xp_total/xp_level (level from `experience_levels`) → update streak → upsert user_game_stats. Returns `{ xpAwarded, newLevel?, newBest: boolean, streak }`.
3. Leaderboards: `select … from best_scores join users … where game_id = $1 order by score desc limit 50`; "friends" variant joins `follows` where status = accepted. Both are single queries.
4. Feed: a single query ranking games by (recent plays, avg rating, updated_at) cached in memory for 60 s per container.
5. Env flag `DATA_BACKEND=dynamo|postgres` selecting the old or new services at startup (keeps prod working until T6.5).
6. Tests: repos against a local Postgres via `testcontainers` or `pglite` (`@electric-sql/pglite` runs Postgres in-process and is simplest for CI); services with the pglite db.
Done when: `DATA_BACKEND=postgres npm run server` passes a curl script covering every route; `npm test` runs the repo tests against pglite.

## T6.4 Migrate data from DynamoDB
Status: todo
Depends on: T6.3
Goal: all existing users, scores, ratings, follows and stats are in Postgres.
Files: `apps/backend-api/scripts/migrate-dynamo-to-postgres.ts`
Steps:
1. Script reads each DynamoDB table (paginated scan) and writes to Postgres in batches with `onConflictDoNothing`. Maps: users (uid → id), scores → plays (plus computed best_scores), ratings, follows (status accepted), userGameStats, game-config → games.
2. Idempotent and resumable; prints counts per table (no identities).
3. MANUAL (James): run it once against prod DynamoDB with read-only AWS credentials and the Supabase migrations URL. Claude writes the exact command.
4. Verify: counts match; top-10 leaderboard for three games matches the live API output.
Done when: the verification numbers are recorded in the PR; the script is committed.

## T6.5 Cut over
Status: todo
Depends on: T6.4, Phase 9 pipeline (so the Lambda env is managed in CI)
Steps:
1. Set `DATA_BACKEND=postgres` and `DATABASE_URL` on the Lambda via the workflow. Deploy.
2. Re-run the migration script in "delta" mode (only rows newer than the first run) to catch plays made in between.
3. Watch CloudWatch errors for a day.
4. Remove the Dynamo code path, the AWS SDK Dynamo packages, `TABLE_*` env vars and `docs/followers-aws-setup.md` (archive).
5. MANUAL (James): after a week, delete the DynamoDB tables (or export to S3 first) to keep the AWS account clean.
Done when: `git grep -i dynamo apps` is empty; prod leaderboards and profiles work; the review's "players per game" numbers are preserved.

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
Depends on: T6.5
Steps: GitHub Actions cron (weekly) runs `scripts/db-ping.mjs` against `DATABASE_URL` to stop the free-tier pause; a daily cron deletes presence rows older than 1 day and anonymous users with no plays older than 90 days (count logged, no identities).
Done when: both workflows run green once (trigger with `workflow_dispatch`).

## T6.10 Optional later: port the API to Supabase Edge Functions
Status: todo (deferred; decide after Phase 10)
Goal: remove AWS entirely by running the API as a Hono app on Supabase Edge Functions (Deno), keeping Drizzle. Only worth it if AWS becomes a cost or a maintenance burden. Record the decision in `DECISIONS.md` when taken.
