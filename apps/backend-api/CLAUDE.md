# backend-api

Express API deployed as a single AWS Lambda behind api.games4james.com. Read the root `CLAUDE.md` and `docs/plan/README.md` first.

## Commands (from the repo root)

```bash
npm run server          # local API on http://localhost:8787 (tsx + .env.local)
npm run backend:build   # tsc → apps/backend-api/dist
npm run typecheck
```

Local setup: copy `apps/backend-api/.env.example` to `.env.local` and fill in values (ask James; never paste them into chat or commits). Local runs talk to the real DynamoDB tables in the AWS account, so treat writes with care.

## Structure (`src/`)

- `index.ts` builds the Express app (CORS, JSON, `attachUser`, routes). `lambda.ts` wraps it with `serverless-http` and is the Lambda entry; the handler is `dist/lambda.handler`. `dev-server.ts` runs it locally.
- `routes/` → `controllers/` → `services/` → DynamoDB. Some controllers still call DynamoDB directly; new code goes through a service.
- `middleware/authGuards.ts`: verifies the Firebase ID token from `Authorization: Bearer …` and sets `req.user`. `requireAuth` and `requireAdmin` guard routes. Admin is a boolean on the user row.
- `config/index.ts`: env and table names. `data/experienceLevels.ts`: default XP curve.

## Route map

| Prefix | Routes |
|---|---|
| `/me` | GET current user |
| `/auth/firebase` | register-anonymous, register-username, login-username, me, link-provider, change-pin, add-email, send-verification, check-email-verified, admin/reset-pin |
| `/users` | GET me, POST screen-name, POST preferences, PATCH settings, GET streak, POST streak/checkin, GET :userId |
| `/scores` | GET :gameId (leaderboard), POST / (submit, auth) |
| `/experience` | GET summary, POST runs |
| `/ratings` | GET /, GET :gameId, POST :gameId |
| `/followers` | summary, following, followers, activity, ids, notifications, POST status, POST/DELETE :targetUserId |
| `/games` | GET config, GET config/:gameId, GET feed, GET feed/personalized |
| `/admin` | users list/get/update, games list/create/get/stats/update, metrics/dashboard |
| `/rewards`, `/shop` | ping placeholders, removed in T1.9 |

## Data layer

DynamoDB tables named `games4james-*` (users, scores, gameratings, gameratings-summary, follows, presence, userGameStats, experience-levels, game-config, usernames). Phase 6 moves everything to Supabase Postgres with Drizzle. **Do not add new DynamoDB tables.**

## Rules

- **Never trust the client.** Scores, XP multipliers, streak dates and durations are validated or computed on the server (T1.4).
- **No PII in logs.** No emails, usernames, user ids or raw Firebase error objects. Log an event name and a code.
- Public responses must never include email, admin, preferences or last-login fields (T1.2).
- Error responses must not echo raw `e.message` for server errors (T1.11).

## Environment variables (names only)

`APP_BASE_URL`, `AWS_REGION`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `CORS_ALLOWED_ORIGINS`, and the table names `TABLE_USERS`, `SCORES_TABLE`, `TABLE_RATINGS`, `TABLE_RATING_SUMMARY`, `TABLE_FOLLOWS`, `TABLE_PRESENCE`, `TABLE_USER_GAME_STATS`, `TABLE_EXPERIENCE_LEVELS`, `TABLE_GAME_CONFIG`, `TABLE_USERNAMES`. The `COGNITO_*` entries in `.env.example` are dead and removed in T1.9. Production values are set by the deploy workflow.

## Deploy

GitHub Actions on push to `main`: `tsc`, zip `dist` + prod `node_modules`, `aws lambda update-function-code`, then the env block. Runtime moves to Node 24 in T2.1/T9.1; bundling with esbuild comes in T9.3.
