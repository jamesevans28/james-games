# Phase 2: Full dependency upgrade

Get on the latest of everything. Do it in the order below, one task per session, with the app running at the end of each. Versions below were the latest on 8 Oct 2026; re-check with `npm view <pkg> version` at the time of each task and use whatever is latest then.

Known breaking changes are listed per task so the session doesn't have to discover them.

| Package | From | To (Oct 2026) |
|---|---|---|
| Node | 20 (CI) / 22.14 (local) | 24 LTS |
| typescript | 5.7 | 7.x (native compiler; see T2.2 note) |
| vite | 7.2 | 8.x |
| @vitejs/plugin-react | 5.1 | 6.x |
| vite-plugin-pwa | 1.2 | 2.x |
| tailwindcss / @tailwindcss/vite | 4.1 | 4.3+ |
| react / react-dom | 19.2 | 19.3+ |
| react-router-dom 7 | 7.10 | `react-router` 8.x (single package) |
| firebase (web) | 12.7 | 13.x |
| firebase-admin | 13.6 | 14.x |
| phaser | 3.90 | 4.2+ |
| express | 4.19 | 5.x |
| serverless-http | 3.2 | 4.x |
| @aws-sdk/* | 3.6xx | latest 3.x |
| bcryptjs, cors | 3.0 / 2.8 | latest |
| eslint | 9 (unconfigured) | 10.x flat config (Phase 4 configures) |
| vitest | none | 5.x (Phase 4) |
| @types/node | 20 | 24+ |

## T2.1 Node 24 and npm hygiene
Status: done (2026-10-08) except the MANUAL local install. .nvmrc = 24, engines node >=24 / npm >=10, workflow uses node-version-file + npm ci. Lockfile regenerated from scratch on Node 24.21 (fresh resolution raised minors within existing ranges, e.g. React 19.3, react-router-dom 7.18, Vite 7.3, Tailwind 4.3, firebase-admin 13.10). Under Node 24: typecheck, 46 tests, all three builds and npm ci all pass. Lambda checked read-only: nodejs22.x, dist/lambda.handler, 128 MB, 3 s (runtime move + memory/timeout noted in T9.1). MANUAL (James): your Mac still runs Node 22.14 from the official installer at /usr/local/bin/node; install Node 24 (nodejs.org LTS installer, or brew install node@24) so local runs match CI. Until then npm prints an EBADENGINE warning but works.
Depends on: Phase 1 complete
Goal: every environment uses Node 24 LTS and a clean lockfile.
Files: `.nvmrc` (new), `package.json` `engines`, `.github/workflows/deploy.yml`, `apps/backend-api/tsconfig.json` (`target`/`lib`)
Steps:
1. Add `.nvmrc` with `24`. Add `"engines": { "node": ">=24", "npm": ">=10" }` to the root `package.json`.
2. Workflow: `node-version-file: .nvmrc`. Replace `npm ci || npm install` with `npm ci`.
3. MANUAL (James): `nvm install 24 && nvm use 24` locally.
4. Lambda runtime: note in `apps/backend-api/CLAUDE.md` that the function must run `nodejs22.x` or `nodejs24.x`; Phase 9 sets it in the workflow with `aws lambda update-function-configuration --runtime`.
5. Delete and regenerate `package-lock.json` once on Node 24.
Done when: `node -v` is 24.x locally and in CI; `npm ci` is clean; all three apps build.

## T2.2 TypeScript latest
Status: done (2026-10-08). TypeScript 6.0.3 in all workspaces, not 7.0.2: typescript-eslint (latest 8.71) supports only TS <6.1 and Phase 4 needs it; recorded in DECISIONS.md with a re-check date. Backend moved from the deprecated moduleResolution node10 to NodeNext (no code changes). verbatimModuleSyntax on in all three apps (44 type-only imports fixed in 27 files). noUncheckedIndexedAccess on for backend-api and admin-web (two real edge cases guarded); deferred for player-web to T5.13 because 93 of its 102 errors are in game code Phase 5 rewrites. Verified on Node 24: typecheck, 46 tests, all builds; compiled backend serves /games/config; dist/lambda.js loads on Node 22 (the Lambda runtime).
Depends on: T2.1
Goal: latest TypeScript in all workspaces.
Files: root and workspace `package.json`, all `tsconfig*.json`
Steps:
1. `npm i -D typescript@latest -w apps/player-web -w apps/backend-api -w apps/admin-web`. If the latest major is the native (Go) compiler line (7.x), confirm `@vitejs/plugin-react`, `typescript-eslint` and `drizzle-kit` support it; if any does not yet, pin to the latest 6.x/5.9.x and record the reason in `DECISIONS.md` with a date to re-check.
2. Enable `"verbatimModuleSyntax": true`, `"noUncheckedIndexedAccess": true`, `"moduleResolution": "bundler"` (web) / `"nodenext"` (backend). Fix fallout.
3. Keep `strictPropertyInitialization: false` only if the Phaser scene pattern needs it; prefer definite assignment (`!`) with a comment.
Done when: `npm run typecheck` exits 0 everywhere.

## T2.3 Vite 8, plugin-react 6, vite-plugin-pwa 2, Tailwind 4.3
Status: done (2026-10-08). Vite 8.3, @vitejs/plugin-react 6.1, vite-plugin-pwa 2.0, Tailwind 4.3 (+ @tailwindcss/vite) in both web apps; npm dedupe so every plugin shares Vite 8. Player web: vite/config.dev.mjs + config.prod.mjs merged into vite.config.ts (command-based: API-URL guard on build only, service worker in dev only with VITE_SW_DEV=1); Phaser chunk via Rolldown output.codeSplitting.groups (manualChunks object form is gone); default Oxc minifier replaces terser (JS total 2.02 MB vs 2.03 MB before). Admin: @tailwindcss/postcss + postcss.config.js replaced by @tailwindcss/vite; tracked tsc output vite.config.js/.d.ts deleted (Vite loads .js before .ts, so edits to the .ts would have been ignored); build now typechecks with --noEmit. Project references removed from both tsconfigs. Verified: typecheck, both builds, Tailwind CSS generated, sw.js has the T1.5 API rules, dev server runs a game with only expected API-offline errors, and dev registers no service worker.
Depends on: T2.2
Goal: the two web apps build on the latest toolchain.
Files: `apps/player-web/vite/*.mjs`, `apps/player-web/postcss.config.js`, `apps/admin-web/vite.config.ts`, `apps/admin-web/postcss.config.js`, `apps/*/index.css`
Steps:
1. Upgrade `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa`, `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/typography`, `terser`, `postcss`.
2. Read each package's changelog for the major bump (Vite 8: check `build.rolldownOptions` vs `rollupOptions` if Vite 8 ships Rolldown by default; `manualChunks` for the Phaser chunk may need the new API). vite-plugin-pwa 2: check the `workbox` option shape and `devOptions`.
3. Remove `postcss.config.js` from both apps if `@tailwindcss/vite` is used (Tailwind 4 doesn't need PostCSS).
4. Merge the two Vite configs into one `vite.config.ts` with `mode`-based differences (dev enables the SW only behind `VITE_SW_DEV=1`). Delete `vite/config.dev.mjs` and `config.prod.mjs`; update `package.json` scripts and `.claude/launch.json`.
Done when: `npm run web:build` and `npm run admin:build` succeed; `dist/sw.js` exists; the app runs in the Browser pane with no console errors.

## T2.4 React 19.x latest and React Router 8
Status: done (2026-10-08). React 19.3 (+ types) and react-router 8.4 in both web apps; react-router-dom removed and all 24 files import from "react-router" (no API changes needed for BrowserRouter, Routes, Route, Link, NavLink, Navigate, Outlet and the hooks). Every page except the home feed is now React.lazy behind one Suspense: main chunk 545 KB to 326 KB (Firebase auth split into its own 122 KB chunk). Note: react-router 8 declares node >=22.22 for tooling; CI uses 24, local 22.14 only warns. Verified: typecheck, both builds, and all 9 routes render in the Browser pane with no JS errors (settings/followers/notifications redirect guests to /login as designed).
Depends on: T2.3
Goal: latest React and the single `react-router` package.
Files: `apps/player-web/src/App.tsx`, every file importing `react-router-dom`, `apps/admin-web/src/**`
Steps:
1. `npm i react@latest react-dom@latest` in both web apps; `@types/react*` to match.
2. Replace `react-router-dom` with `react-router@latest`; change every import. Read the v8 upgrade guide for renamed APIs (`BrowserRouter`, `useNavigate`, `Link` are stable; check data-router changes if any are used; the app uses plain `<Routes>`).
3. Add `React.lazy` + `Suspense` for every page route in `App.tsx` (this is a Phase 4 item too; do the mechanical part here).
Done when: builds pass; every route in the app renders in the Browser pane (home, games-list, login, a game, leaderboard, profile, settings, followers, notifications).

## T2.5 Firebase 13 (web) and firebase-admin 14
Status: done (2026-10-08) for code; two flows need a manual check. firebase 13.0.0 (player-web, admin-web) and firebase-admin 14.5.0 (backend; requires Node >=22, fine for the nodejs22.x Lambda). No code changes were needed. Verified live: the browser app signs in anonymously and gets an ID token with SDK 13; through the local API, Admin 14 accepts a real anonymous token on signed-in read-only routes (200) and rejects a bad one (401) - using a throwaway anonymous Firebase user that the script then deleted (a first attempt failed at cleanup and left one anonymous user in Firebase Auth, identical to any first-time visitor). MANUAL (James): try username + PIN sign-in and Google sign-in once against `npm run server` (PIN creates a real production account; Google needs your account), or after the next deploy.
Depends on: T2.4
Goal: latest Firebase SDKs.
Files: `apps/player-web/src/lib/firebase.ts`, `context/FirebaseAuthProvider.tsx`, `apps/admin-web/src/lib/firebase.ts`, `apps/backend-api/src/services/firebaseAuthService.ts`, `middleware/authGuards.ts`
Steps:
1. Upgrade; read both changelogs for removed APIs (modular API is already used).
2. Add `firebase` to `apps/admin-web/package.json` if T1.9 did not.
3. Verify anonymous sign-in, username+PIN, Google popup (web) and token verification locally against the dev backend.
Done when: all four auth flows work in the Browser pane against `npm run server`; `npm run typecheck` passes.

## T2.6 Express 5 and serverless-http 4
Status: done (2026-10-08) except the zip-size target. Express 5.2, serverless-http 4.0, @types/express 5, cors 2.8.6, AWS SDK 3.1147, dotenv 18, @types/node 24. Only Express 5 breaks: app.options("*") removed (global cors() answers preflight) and route params typed string|string[] (5 handlers now use String()). Added a JSON 404 before the error middleware. Verified locally against production tables with read-only calls (throwaway anonymous user, deleted after): 29 route checks (public reads 200, signed-in reads 200, admin 403, guest 401, validation 400, retired XP route 410, preflight 204, foreign origin 403, unknown route 404) with no server errors; compiled dist/lambda.js answers REST API v1 and HTTP API v2 events. Zip: 18.8 MB (16.7 MB before the upgrade), so the "<10 MB" check is not met; AWS allows 50 MB and T9.3 (esbuild bundle, <3 MB) is the real fix.
Depends on: T2.1
Goal: the backend runs on Express 5 locally and on Lambda. `parallel-ok` with T2.3–T2.5.
Files: `apps/backend-api/src/index.ts`, all `routes/*.ts`, `controllers/*.ts`, `middleware/*.ts`, `lambda.ts`, `dev-server.ts`
Steps:
1. Upgrade `express@5`, `@types/express@5`, `serverless-http@4`, `cors`, `bcryptjs`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `dotenv`, `tsx`.
2. Express 5 breaking changes to handle: async handlers now propagate rejections to the error middleware (good; delete manual try/catch-to-next boilerplate where safe); `req.query` is a getter (don't assign); route path syntax changes (`*` wildcards need a name, `?` optional segments use `{}`); `res.redirect("back")` removed; `app.del` removed.
3. Ensure the central error middleware from T1.11 is last.
4. Start locally, hit every route with curl (document the list in `apps/backend-api/CLAUDE.md`).
Done when: `npm run backend:build` passes; every route responds locally; the Lambda zip is under 10 MB (check `node_modules` prod-only install still works).

## T2.7 Phaser 4
Status: done (2026-10-08). Phaser 4.2.1. Typecheck flagged 5 games, all fixed: Cosmic Clash, Snapadile, Ho Ho (group.children is now a native Set: .entries/.iterate -> getChildren(), which returns a fresh array so removal during loops is now safe), Flash Bash (fillPoints/strokePoints typed Vector2[]: wrapped literals), Paddle Pop (setTintFill removed: setTint + TintModes.FILL, with an explicit flag and mode reset because clearTint keeps the mode), Reflex Ring (Math.PI2 removed -> Math.TAU, now 2π). No masks, FX, pipelines, render textures, Geom.Point or Grid shapes in use. Smoke test in the Browser pane: 16/16 games start with no JS errors; Paddle Pop, Cosmic Clash, Flash Bash, Blocker, Snapadile, Box Cutter and Reflex Ring checked visually at 375x812 (Snapadile and Box Cutter match the Phaser 3 screenshots); Flash Bash game-over flow ran. Phaser chunk 1.31 MB (354 KB gzip), up from 1.14 MB on Phaser 3.
Depends on: T2.3
Goal: all 16 games compile and run on Phaser 4.x. Deep per-game polish is Phase 5; this task is the mechanical migration.
Files: `apps/player-web/src/games/**`, `apps/player-web/src/game/ui/*.ts`
Steps:
1. Read the official migration guide (https://phaser.io/news/2026/04/migrating-from-phaser-3-to-phaser-4-what-you-need-to-know) and the migration skill that ships in the package (`node_modules/phaser/skills/v3-to-v4-migration/SKILL.md`).
2. `npm i phaser@latest -w apps/player-web`. Run `npm run typecheck`; fix type breaks.
3. Known areas: the renderer and FX/mask APIs changed (unified Filter system); `preFX`/`postFX` and `mask` calls must move to filters; custom pipelines are gone (none are used). Graphics, Text, Sprite, Tweens, Arcade Physics are largely source-compatible. Check `Scale.FIT`/`RESIZE` behaviour and `this.cameras.main` APIs.
4. Smoke-test every game in the Browser pane at 375×812: it loads, input works, game over fires, Play Again works. Record a one-line result per game in the PR.
5. Update `apps/player-web/CLAUDE.md`: Phaser 4 is the baseline; no v3 pipeline APIs.
Done when: 16/16 games load and reach game over; no console errors; bundle size of the Phaser chunk noted in the PR.

## T2.8 Everything else, and a dependency policy
Status: todo
Depends on: T2.7
Goal: no outdated packages; a rule for staying current.
Files: all `package.json`, `.github/dependabot.yml` (new)
Steps:
1. `npm outdated --workspaces` and upgrade whatever remains (`@types/*`, `globals`, `eslint-plugin-*`, `@tanstack/react-query` when added, etc.).
2. Add `.github/dependabot.yml` with weekly grouped npm updates (one PR for minors/patches, separate PRs for majors) across the root and the three workspaces, plus `github-actions`.
3. Add `npm run deps:check` → `npm outdated --workspaces --long`.
Done when: `npm outdated --workspaces` prints nothing (or only packages pinned with a reason in `DECISIONS.md`); Dependabot config is valid (GitHub shows it under Insights → Dependency graph).
