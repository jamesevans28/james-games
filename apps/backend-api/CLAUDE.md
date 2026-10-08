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
- `routes/` → `controllers/` → `services/` → DynamoDB. Some controllers still call DynamoDB directly; new code goes through a service.
- `middleware/authGuards.ts`: verifies the Firebase ID token from `Authorization: Bearer …` and sets `req.user`. `requireAuth` and `requireAdmin` guard routes. Admin is a boolean on the user row.
- `config/index.ts`: env and table names. `data/experienceLevels.ts`: default XP curve.

## Route map

| Prefix           | Routes                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/me`            | GET current user                                                                                                                       |
| `/auth/firebase` | register-anonymous, register-username, login-username, me, link-provider, change-pin, add-email, check-email-verified, admin/reset-pin |
| `/users`         | POST screen-name, POST preferences, PATCH settings, GET streak, POST streak/checkin, GET :userId                                       |
| `/scores`        | GET :gameId (leaderboard), POST / (submit, auth)                                                                                       |
| `/experience`    | GET summary (POST runs returns 410; XP comes from POST /scores)                                                                        |
| `/ratings`       | GET /, GET :gameId, POST :gameId                                                                                                       |
| `/followers`     | summary, following, followers, activity, ids, notifications, POST status, POST/DELETE :targetUserId                                    |
| `/games`         | GET config, GET config/:gameId, GET feed, GET feed/personalized                                                                        |
| `/admin`         | users list/get/update, games list/create/get/stats/update, metrics/dashboard                                                           |

## Data layer

Supabase Postgres (project in ap-southeast-2) through Drizzle ORM (Phase 6). The DynamoDB tables named `games4james-*` are the prototype's: not migrated, deleted at relaunch (T13.6). **Do not add DynamoDB code.**

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

`APP_BASE_URL`, `AWS_REGION`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `CORS_ALLOWED_ORIGINS`, and the table names `TABLE_USERS`, `SCORES_TABLE`, `TABLE_RATINGS`, `TABLE_RATING_SUMMARY`, `TABLE_FOLLOWS`, `TABLE_PRESENCE`, `TABLE_USER_GAME_STATS`, `TABLE_EXPERIENCE_LEVELS`, `TABLE_GAME_CONFIG`, `TABLE_USERNAMES`. Production values are set by the deploy workflow.

## Deploy

Manual for now (GitHub Actions → Deploy Apps → Run workflow): a `checks` job (typecheck + tests), then `tsc`, zip `dist` + prod `node_modules`, `aws lambda update-function-code`, then the env block.

Lambda `gamesjames_scores` (checked 2026-10-08): runtime `nodejs22.x`, handler `dist/lambda.handler`, x86_64, 128 MB, 3 s timeout. Local dev and CI use Node 24 (`.nvmrc`); the compiled output (ES2022) runs on both. T9.1 moves the runtime to `nodejs24.x` and should raise memory/timeout (3 s is tight for Firebase cold starts). Bundling with esbuild comes in T9.3.
