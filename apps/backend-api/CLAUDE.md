# backend-api

Express API deployed as a single AWS Lambda behind api.games4james.com. Read the root `CLAUDE.md` and `docs/plan/README.md` first.

## Commands (from the repo root)

```bash
npm run server          # local API on http://localhost:8787 (tsx + .env.local)
npm run backend:build   # tsc → apps/backend-api/dist
npm run typecheck
```

Local setup: copy `apps/backend-api/.env.example` to `.env.local` and fill in values (ask James; never paste them into chat or commits). Local runs use the Supabase database in `DATABASE_URL`. Until relaunch it holds only test data, but keep the habit of not writing to production from a local shell.

## Structure (`src/`)

- `index.ts` builds the Express app (CORS, JSON, `attachUser`, routes). `lambda.ts` wraps it with `serverless-http` and is the Lambda entry; the handler is `dist/lambda.handler`. `dev-server.ts` runs it locally.
- `routes/` → `controllers/` (HTTP only) → `services/` (rules) → `repos/` (Drizzle queries, one file per area) → Postgres.
- `middleware/authGuards.ts`: verifies the Firebase ID token from `Authorization: Bearer …` and sets `req.user`. `requireAuth` and `requireAdmin` guard routes. Admin is a boolean on the user row.
- `config/index.ts`: env. `data/experienceLevels.ts`: the XP curve (seeded into `experience_levels`). `db/`: schema, client, migrate/seed/housekeeping.

## Route map

| Prefix           | Routes                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/me`            | GET current user                                                                                                                                        |
| `/auth/firebase` | register-anonymous, register-username, login-username, me (same as `/me`), link-provider, change-pin, add-email, check-email-verified, admin/reset-pin  |
| `/users`         | POST screen-name, POST preferences, PATCH settings, GET streak, POST streak/checkin, GET :userId                                                        |
| `/scores`        | GET :gameId (leaderboard), POST / (submit, auth)                                                                                                        |
| `/experience`    | GET summary (POST runs returns 410; XP comes from POST /scores)                                                                                         |
| `/ratings`       | GET /, GET :gameId, POST :gameId                                                                                                                        |
| `/followers`     | summary, following, followers, activity, ids, notifications, POST status, POST/DELETE :targetUserId                                                     |
| `/games`         | GET config, GET config/:gameId, GET feed, GET feed/personalized                                                                                         |
| `/admin`         | users list/get/update, users/:id reset-screen-name/disable/enable, DELETE plays/:playId, games list/get/stats/update (metadata only), metrics/dashboard |

## Data layer

Supabase Postgres (project in ap-southeast-2) through Drizzle ORM (Phase 6). The prototype's AWS NoSQL tables (`games4james-*`) are not migrated and are deleted at relaunch (T13.6). **All data lives in Postgres.**

- `src/db/schema.ts` is the schema. After changing it run `npm run db:generate -w apps/backend-api` and commit the SQL it writes to `drizzle/`. Never edit a migration that has been applied; add a new one.
- `src/db/client.ts`: `getDb()` (one `postgres` connection per Lambda container) and `setDb()` for tests.
- Two connection strings: `DATABASE_URL` is the **transaction pooler** (port 6543) used by the API, which needs `prepare: false` (already set). `DATABASE_URL_MIGRATIONS` is the **session pooler** (port 5432) used only by `db:migrate`.
- `npm run db:migrate|db:seed|db:ping -w apps/backend-api` read `.env.local`. `db:seed` upserts games from `apps/player-web/public/game-meta.json` (manifests own title, status, scoring) and the XP levels; it never touches admin-managed `metadata`. `db:ping` never prints the URLs.
- Tests: `createTestDb()` from `src/test/db.ts` gives a fresh in-process Postgres (pglite) with the real migrations and three test games, and installs it as `getDb()`.

## Express 5 notes

- Route params are typed `string | string[]`: read them as `String(req.params.x)`.
- Path syntax: no bare `*` or `?` segments (use `/{*splat}` and `{/:optional}`). Preflight is handled by the global `cors()` middleware.
- Async handlers that throw reach `errorHandler` (src/lib/http.ts). Unknown routes get JSON `404 {"error":"not_found"}`.
- The Lambda entry (`dist/lambda.js`, serverless-http 4) handles both REST API (v1) and HTTP API (v2) events.

## Rules

- **Never trust the client.** Scores, XP multipliers, streak dates and durations are validated or computed on the server (T1.4).
- **No PII in logs.** No emails, usernames, user ids or raw Firebase error objects. Log an event name and a code.
- Public responses must never include email, admin, preferences or last-login fields (T1.2).
- Error responses must not echo raw `e.message` for server errors (T1.11).

## Environment variables (names only)

`DATABASE_URL`, `DATABASE_URL_MIGRATIONS` (migrations only), `APP_BASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `CORS_ALLOWED_ORIGINS`. Production values are set by `deploy-api.yml` from GitHub secrets.

## Deploy

Manual until relaunch (GitHub → Actions → **Deploy API** → Run workflow; T13.4 turns on the push trigger). It runs the `ci.yml` gates, then `db:migrate`, `db:seed`, `npm run bundle` (esbuild → one `lambda.mjs`, see `scripts/bundle.mjs`), uploads `bundle.zip`, and sets runtime `nodejs24.x`, handler `lambda.handler`, 512 MB, 10 s and the env block. `migrate_only` skips the Lambda.

## Tests

`createTestDb()` (src/test/db.ts) and `startTestApp()` (src/test/app.ts) give each test file its own in-process Postgres with the real migrations, three test games, and fake Firebase tokens (`test:<uid>[:<accountType>[:<email>]]`). Route tests live in `src/routes/*.routes.test.ts`; mock Firebase Admin calls other than token verification with `vi.mock`.
