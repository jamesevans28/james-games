# Phase 1: Security and hygiene

Close the holes found in the review, fix the known bugs, delete dead code, and make type errors fail the build. All on the current DynamoDB backend; Phase 6 replaces the data layer, but these fixes must not wait for it.

Severity key: P0 = fix before any relaunch.

## T1.1 Remove the migrated-account takeover path (P0)
Status: done (2026-10-08). Verified by unit tests (usernamePolicy.test.ts) and code read; a live 409 call against prod Firebase was not made. Root `npm test` now runs backend tests via node:test until Vitest lands in T4.2.
Depends on: none
Goal: nobody can reset another user's PIN by registering their username.
Files: `apps/backend-api/src/controllers/firebaseAuthController.ts` (~lines 75-111, `register-username`)
Steps:
1. Delete the branch that, when a username record has `accountType === "migrated"`, resets its PIN and returns a custom token for that record's userId.
2. If the username exists for any reason, return `409 { error: "username_taken" }`.
3. Remove the permanent "Account System Update" notice from `apps/player-web/src/pages/firebase-login.tsx` (it tells users to re-create accounts with the same username, which is this exploit's instruction manual). Replace with a small "Forgot your PIN? Ask James" link to the parent page (T7.8) for now.
4. Add a Vitest test for the controller's decision logic if it can be isolated; otherwise document the manual check.
Done when: a request to `/auth/firebase/register-username` with an existing username returns 409 and no token; `grep -n "migrated" apps/backend-api/src` shows no reclaim logic.

## T1.2 Public profile whitelist (P0)
Status: done (2026-10-08). Whitelist is userId, screenName, avatar, createdAt, experience (level summary), currentStreak, longestStreak; experience and streaks kept because the profile page shows them. Audit: leaderboards, ratings and follower lists already return only safe fields; follower routes require auth. Verified locally: /users/:id profile keys are exactly the whitelist.
Depends on: none
Goal: `GET /users/:userId` never returns email, admin flag, preferences, lastLoginDate or any internal field.
Files: `apps/backend-api/src/controllers/usersController.ts` (~95-122), `apps/backend-api/src/services/userService.ts` (~121-140)
Steps:
1. Add `toPublicProfile(user)` returning exactly `{ userId, screenName, avatar, xpLevel, xpTotal, createdAt }`.
2. Use it in the public route. Keep the full profile only on `/me` for the authenticated owner.
3. Audit every other public response (leaderboards, followers, feed, presence) for the same fields; apply the same helper.
Done when: `curl https://localhost:8787/users/<id>` (and the equivalent on prod after deploy) returns only the whitelisted keys; a unit test asserts `toPublicProfile` strips `email`.

## T1.3 Stop returning the verification link (P0)
Status: done (2026-10-08). The frontend already sends verification through the Firebase client SDK (sendEmailVerification, which Firebase emails itself) and never called this endpoint, so the endpoint and generateEmailVerificationLink were removed rather than kept returning {ok:true}. Settings UI unchanged because verification still works.
Depends on: none
Goal: `/auth/firebase/send-verification` sends the link by email only.
Files: `apps/backend-api/src/controllers/firebaseAuthController.ts` (~486-490)
Steps:
1. Remove `link` from the JSON response. Return `{ ok: true }`.
2. Confirm the email actually goes out (Firebase `generateEmailVerificationLink` only generates; sending requires an email provider). If no sender exists, mark email verification as "not available" in the UI (`SettingsScreen.tsx`) and hide the feature until Phase 7 decides on email.
Done when: the response body contains no URL; the settings UI does not promise verification that cannot be sent.

## T1.4 Server-side XP, score bounds and streak dates (P0)
Status: done (2026-10-08). Score limits default to 1,000,000 max and 2,000 per second (live top score is 87,682), overridable per game via game-config metadata.maxScore / maxScorePerSecond; non-integer scores are rounded, not rejected. XP is awarded inside POST /scores from the server game config (unknown games such as word-stack, which has no config row, use multiplier 1); POST /experience/runs returns 410. Note: server multipliers differ from the old client registry for some games (e.g. box-cutter 0.3 server vs 0.03 client), so XP per run changes for those. Streak date = server clock + clamped tzOffsetMinutes; XP and streak writes are conditional. Verified by 25 unit tests; authenticated live 400s were not exercised because the local API writes to production tables.
Depends on: none
Goal: scores, XP and streaks cannot be inflated from the client.
Files: `apps/backend-api/src/controllers/scoresController.ts`, `services/scoresService.ts` (~169), `controllers/experienceController.ts` (~22), `services/experienceService.ts`, `controllers/streakController.ts` (~16-21), `services/streakService.ts`, `services/gamesConfigService.ts`, frontend `apps/player-web/src/lib/api.ts` (~131-145), `apps/player-web/src/pages/games/GameOver.tsx`
Steps:
1. Score submission: validate `score` is a finite integer ≥ 0 and ≤ `maxScore` for the game. Add `maxScore` and `maxScorePerSecond` to game config (defaults 1,000,000 and 1,000 until Phase 4 manifests supply real values). If `durationMs` is present, reject when `score / (durationMs/1000) > maxScorePerSecond`.
2. Award XP inside the score submission: `xp = min(5000, round(score * config.xpMultiplier))` using the server's game config. Remove `xpMultiplier` from the request body of `/experience/runs`; make that route return 410 or delete it, and update `GameOver.tsx` to call only `postHighScore`, reading XP from its response.
3. Streaks: ignore client `todayDate`; compute from server UTC with an optional `tzOffsetMinutes` clamped to [-840, 840].
4. Make the XP/streak updates conditional writes (DynamoDB `ConditionExpression` on `xpUpdatedAt`/`streakUpdatedAt`) to avoid lost updates. Keep it simple; Phase 6 moves this to SQL transactions.
Done when: a Vitest unit test covers `validateScore`, `xpForScore`, and `nextStreak`; posting `score: 1e12` returns 400; posting a run with a client multiplier has no effect.

## T1.5 Service worker: never cache authenticated responses (P0)
Status: done (2026-10-08). Only GET /games/config(/:id), GET /ratings and GET /scores/:gameId without ?scope are cached (NetworkFirst, 1 h offline fallback); every other api.games4james.com or localhost:8787 request is NetworkOnly. GET /ratings/:gameId stays uncached because it includes the signed-in user's own rating. Verified by evaluating the built sw.js rule against 16 URL cases. Not verified: offline play end-to-end (needs the prod build served with the network off).
Depends on: none
Goal: one child can never see another's profile, followers or feed from the cache on a shared device.
Files: `apps/player-web/vite/config.prod.mjs` (runtimeCaching ~40-70), `apps/player-web/vite/config.dev.mjs`
Steps:
1. Replace the `/api/auth/` and `/me` NetworkFirst rules with `NetworkOnly` for `/auth/`, `/me`, `/users/me`, `/users/streak`, `/followers/`, `/experience/`, `/ratings/me` and any route that uses the bearer token.
2. Cache only public, user-independent GETs: `/scores/:gameId`, `/ratings/:gameId`, `/games/config`, `/games/feed` (NetworkFirst, 60s).
3. Replace the `api.flingo.fun` URL pattern with `api.games4james.com` (Phase 3 moves this into `brand.ts`; for now just correct it).
4. Remove the `navigator.onLine` gate in `apps/player-web/src/pages/games/PlayGame.tsx` (~121-124) so precached games play offline; keep the offline banner.
Done when: build, inspect `dist/sw.js`, confirm no `NetworkFirst` entry matches an authenticated route; offline play works in the Browser pane with the network disabled.

## T1.6 Strip PII from logs
Status: todo
Depends on: none
Goal: no email, username, userId or raw auth-library error object is logged anywhere (org rule).
Files: backend `firebaseAuthController.ts` (~76-77, 578-579, 592, 770), `middleware/authGuards.ts` (~52), `services/followersService.ts` (~241), `scripts/*.ts`; frontend `context/FirebaseAuthProvider.tsx` (~254-390, 22 logs), `lib/firebase.ts` (~124), `pages/games/GameLanding.tsx` (~316)
Steps:
1. Backend: add `src/lib/log.ts` with `log.info/warn/error(event: string, fields?: Record<string, string|number|boolean>)` that JSON-serialises and refuses keys named `email`, `username`, `screenName`, `userId`, `uid`, `token`. Log error `code` and `message` only, never the object.
2. Replace every `console.*` in `src/` with `log.*`. Scripts may keep console output but must print counts, not identities.
3. Frontend: delete the debug logs in the three files; keep at most one `console.warn` per failure path with no identifiers.
Done when: `grep -rn "console\." apps/backend-api/src apps/player-web/src | grep -v "console.warn\|console.error"` is empty, and the remaining warn/error calls print no identifiers (manual read).

## T1.7 Set `TABLE_USERNAMES` in production and enforce uniqueness
Status: todo
Depends on: none
Goal: screen-name uniqueness is enforced in prod, not only locally.
Files: `.github/workflows/deploy.yml` (Lambda env block ~154-176), `apps/backend-api/src/services/userService.ts` (~199)
Steps:
1. Add `"TABLE_USERNAMES": "games4james-usernames"` to the Lambda environment in the workflow.
2. MANUAL (James): confirm the DynamoDB table `games4james-usernames` exists with partition key `screenNameKey` (string). If not, create it (on-demand capacity). Claude writes the exact AWS CLI command into the PR description.
3. Make `reserveScreenName` fail closed: if the env var is missing, throw at startup rather than returning `true`.
Done when: registering the same username twice in prod returns 409.

## T1.8 Make type errors fail the build; fix the known ones
Status: todo
Depends on: T0.4
Goal: `npm run typecheck` is clean and runs in CI before any deploy.
Files: `apps/player-web/src/games/block-breaker/BlockBreakerScene.ts` (~39-40), the 8 unused-symbol errors, `apps/player-web/tsconfig.node.json` (references a non-existent `vite.config.ts`), backend `declare const process: any` (8 files), `@ts-ignore` on `req.user` (~40 sites)
Steps:
1. Fix the two real errors in block-breaker (or, since the game goes inactive in Phase 5, make it compile minimally).
2. Remove unused symbols. Fix `tsconfig.node.json` to include `vite/*.mjs` or drop it.
3. Backend: add `src/types/express.d.ts` augmenting `Express.Request` with `user?: AuthUser`; delete every `@ts-ignore` and `declare const process: any` (`@types/node` is installed).
4. Add `typecheck` to the CI workflow as a gate before build (full CI rework is Phase 9; add the single step now).
Done when: `npm run typecheck` exits 0 in all workspaces; `grep -rn "ts-ignore\|declare const process" apps/*/src` is empty.

## T1.9 Delete dead code and leftovers
Status: todo
Depends on: T1.8
Goal: remove everything the review identified as unused (about 3,000 lines), so later phases don't trip over it.
Files: see list.
Steps:
1. player-web: `src/pages/index.tsx.old`, `src/pages/games/[gameId].tsx.old`, `src/components/NameDialog.tsx.old`, `src/components/RootLayout.tsx.old`, `src/PhaserGame.tsx`, `src/game/main.ts`, `src/game/EventBus.ts`, `src/pages/home/index.tsx`, `src/hooks/useSession.ts`, `src/styles/globals.css`, `tailwind.config.js`, `public/publicroot`, `public/games-index.html`, `public/assets/bg.png`, `star.png`, `rocket-spinner.svg`, `boot-asset-pack.json`, `preload-asset-pack.json`, the `phasermsg` plugin block in `vite/config.prod.mjs`, devDeps `@tailwindcss/postcss`, `autoprefixer`, `pureimage` (move `pureimage` to the root `package.json` devDeps because `scripts/` uses it).
2. `src/hooks/useFeedAlgorithm.ts`: move `recordGamePlayed`, `getLastPlayedGames`, `LAST_PLAYED_KEY` into `src/utils/playHistory.ts`; update `PlayGame.tsx`, `GameTile.tsx`, `useFeedAlgorithmV2.ts`; delete the file.
3. games: `flash-bash/index.js`, `flash-bash/index.d.ts`, `flash-bash/ShapeRecallGame.ts`, `snapadile/main.ts`, `snapadile/SnapadileGameView.tsx`, `box-cutter/useCases/{collision,enemyMovement,playerMovement,areaCalculation}.ts`, reflex-ring's unused `bg.svg`, `button.svg`, `dot.svg` (keep the four `powerup-*.svg` for T5.2), serpento's unused `snake-head.svg` load call. Fix the registry import `./flash-bash/index.ts` back to `./flash-bash/index`.
4. backend: `src/handler.ts`, `src/local-server.ts`, `src/dynamo.ts`, `dev-runner.mjs`, `dynamoService.putScore/getTopScores`, `scoresService.adaptLegacyRow`, `routes/rewards.routes.ts`, `routes/shop.routes.ts`, duplicate `/me` (keep `/me`, remove `/users/me` and `/auth/firebase/me` after updating the frontend to use one), unused imports in `src/index.ts`, deps `@aws-sdk/client-cognito-identity-provider`, `cookie-parser`, `nodemon`, `ts-node`, `ts-node-dev`; scripts `migrate-scores.js`, `migrate-cognito-to-firebase.ts`, `sync-usernames-from-cognito.ts`, `update-firebase-usernames.ts`, one of the two game-config seeders; `apps/backend-api/infra/` (stale compiled CDK output); root `fix-lambda-env.sh`; all `COGNITO_*` lines in every `.env.example`.
5. Set `package.json` `main` to `dist/lambda.js` and record in `apps/backend-api/CLAUDE.md` that the Lambda handler is `dist/lambda.handler`.
6. admin-web: remove `signIn/signOut/refresh` from `src/lib/api.ts`, `cognitoUsername` types, the password field in `UserDrawer.tsx`; add `firebase` to its `package.json`.
Done when: `npm run typecheck` and `npm run web:build` pass; `git grep -il cognito -- ':!docs/archive' ':!docs/plan'` is empty; app runs and all public games still load.

## T1.10 Fix the small frontend bugs
Status: todo
Depends on: T1.9
Goal: the known UI bugs from the review are gone.
Files: `components/feed/GameTile.tsx` (~17), `pages/games/GameOver.tsx` (~252-277, 376-480), `hooks/useGameCatalog.ts` (~23), `lib/api.ts` (~3), `context/FirebaseAuthProvider.tsx` (~187), `index.html` (~68, 87-93), `pages/games/GameLanding.tsx` (~216)
Steps:
1. Best-score key: add `src/utils/bestScore.ts` with `getBest(gameId)`/`setBest(gameId, n)` using key `g4j:best:<gameId>` and a one-time migration from `<id>-best` and `<id>-best-score`. Use it in `GameTile.tsx` and in every game (games are refactored in Phase 5, but switch the key now).
2. `GameOver.tsx`: reset `postedRef` when the dialog closes; dedupe by run id, not by score. Show "New best!" when `score > previous best`. Replace the `score % phrases.length` cheer with a tiered one (0 → "Have another go!", < best → "Nice run", ≥ best → "New best!").
3. `useGameCatalog.ts`: read `VITE_API_BASE_URL`; build URLs with the base. Wire it into a `GameCatalogProvider` used by `PlayGame`, `GameLanding`, `leaderboard`, `profile` (keeps bundled `load()`, merges server metadata).
4. Remove the `http://localhost:8787` fallbacks; add `src/config/env.ts` that throws in production when `VITE_API_BASE_URL` is missing.
5. `index.html`: remove the `?search=` SearchAction JSON-LD; the theme-colour/manifest mismatch is fixed in Phase 3.
6. `GameLanding.tsx`: replace the `/assets/logo.png` fallback with the brand logo path (Phase 3 config).
Done when: feed shows "Your best" after a game; two equal consecutive scores both post; the catalog provider fetches `/games/config` without error in the Browser pane console.

## T1.11 Fix backend bugs
Status: todo
Depends on: T1.9
Goal: known backend defects are fixed on DynamoDB so the Phase 6 migration starts from correct behaviour.
Files: `scoresController.ts` (~20-21), `feedController.ts` (~371), `scoresService.ts` (~90-149), `index.ts` (~18-30)
Steps:
1. Score snapshots: look up `screenName`/`avatar` from the user record (not `req.user`) when writing a score.
2. Beta feed: set `betaTester` on `req.user` in `attachUser` from the user row.
3. Following leaderboard: query the followed users' best scores directly instead of filtering the global top 100.
4. CORS: respond 403 for a disallowed origin instead of throwing (500). Keep `credentials` off (no cookies).
5. Central error middleware: map known error codes to statuses; never return raw `e.message` for 500s.
Done when: unit tests for the leaderboard merge and the error mapper pass; a request from a disallowed origin returns 403.
