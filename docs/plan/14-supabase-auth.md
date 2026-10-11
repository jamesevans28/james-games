# Phase 14: Auth on Supabase (Firebase removed)

Decision (2026-10-11, James): **sign-in moves from Firebase Auth to Supabase Auth**, the same `games4james` Supabase project that already holds the data. One cloud account for data and sign-in, no Firebase project to set up now or delete later, a smaller API bundle (no `firebase-admin`), and a smaller web bundle (no `firebase/auth`). This phase runs **before Phase 13** (relaunch) and replaces T6.0, T13.3 and the Firebase half of T10.3. Nothing is live, so there are no users to move.

Scope change (2026-10-11, James): **Google and Apple sign-in are hidden for now.** `features.socialSignIn` in `apps/player-web/src/config/features.ts` is `false`, which removes the buttons from `/login`, the "Linked accounts" card in Settings and the Google/Apple lines on the parents and privacy pages. The code behind them stays. So this phase ports the social flows to Supabase as dormant code, and **no Google Cloud OAuth client, consent screen or Apple Services ID is needed until the flag is turned on.** Sign-in at relaunch is guest and username + PIN. Apple's "Sign in with Apple" rule only applies to apps that offer another third-party sign-in, so the store builds are fine with none.

What stays exactly as it is: the `users` table and every other table, the PIN hashing (bcrypt) and the T7.7 throttle, the route tests on pglite, the screen-name rules, account deletion semantics (T7.8), supporters, share cards, everything in the games.

Supabase Auth facts this phase is built on (verified 11 Oct 2026, re-check on the docs if something misbehaves):

- Anonymous sign-ins exist (`signInAnonymously()`, off by default, 30 per hour per IP by default) and an anonymous user can be **upgraded in place, keeping its id**, with `updateUser({ email })` or `linkIdentity()` (needs "manual linking" on).
- There is no "custom token". The server-side equivalent is the admin API's `generateLink({ type: "magiclink" })`, which returns a one-time `hashed_token` without sending any email, and the client turns it into a session with `verifyOtp({ token_hash, type: "magiclink" })`.
- Custom claims go in `app_metadata` (admin API `updateUserById`), which is copied into every access token. `is_anonymous`, `email` and `app_metadata.providers` are set by Supabase itself.
- Access tokens can be ES256 JWTs signed by a per-project key published at `/auth/v1/.well-known/jwks.json`, so the API verifies them with `jose` and a cached key set, with no network call per request. The project has to be switched from the legacy shared secret to signing keys once (dashboard).
- Native apps use `signInWithIdToken({ provider, token, nonce })` with a Google or Apple ID token; the identity-linking guide shows an id-token flavour of `linkIdentity` for upgrading an anonymous user natively, and supabase-js has `linkIdentityWithIdToken` in recent versions (check the installed version in T14.4).
- The built-in email sender only delivers to the project's own team members, two an hour. We send **no emails at all**, so this never matters (T14.2 drops the add-email feature).
- Custom auth domains are a paid add-on (about US$10 a month). Without one, Google's consent screen says "to continue to `<ref>.supabase.co`" under the app name "Games4James". Accepted for now; James can add the domain later if it bothers him.
- The free tier allows two projects. A second project, `games4james-dev`, is the sign-in for local development and the Browser-pane checks, so dev test accounts never land in the production auth table. Data stays in pglite locally, as today.

Cost: $0.

## Summary of the design

| Flow                                     | Firebase (today)                                                        | Supabase (after this phase)                                                                                                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Guest                                    | `signInAnonymously` → `POST /auth/firebase/register-anonymous`          | `supabase.auth.signInAnonymously()` → `POST /auth/register-anonymous` (same handler)                                                                                                                                                                                     |
| Username + PIN sign-up (guest → account) | backend sets claims, mints custom token, client `signInWithCustomToken` | backend checks the PIN rules, writes the row, `updateUserById(uid, { email: <synthetic>, email_confirm: true, app_metadata: { account_type: "username_pin" } })`, then `generateLink(magiclink)`; returns `tokenHash`; client `verifyOtp` → session for the **same uid** |
| Username + PIN sign-in                   | backend verifies PIN + throttle, mints custom token                     | backend verifies PIN + throttle (unchanged), `generateLink(magiclink)` for that user's synthetic email, returns `tokenHash`; client `verifyOtp`                                                                                                                          |
| Google / Apple on the web                | `signInWithPopup` / `linkWithPopup`                                     | `signInWithOAuth({ provider })` / `linkIdentity({ provider })`: a **redirect**, back to `/auth/callback`; then `POST /auth/link-provider` as today                                                                                                                       |
| Google / Apple in the apps               | `@capacitor-firebase/authentication` → `signInWithCredential`           | `@capgo/capacitor-social-login` → `signInWithIdToken` (sign-in) or `linkIdentityWithIdToken` (upgrade a guest)                                                                                                                                                           |
| API auth                                 | `firebase-admin` `verifyIdToken`                                        | `jose` `jwtVerify` against the project JWKS; claims mapped to the same `AuthUser`                                                                                                                                                                                        |
| Account type claim                       | custom claim `accountType`                                              | `app_metadata.account_type`                                                                                                                                                                                                                                              |
| Delete account                           | `auth.deleteUser`                                                       | `admin.deleteUser(uid)` inside the same transaction                                                                                                                                                                                                                      |
| Admin console sign-in                    | Google popup                                                            | Google redirect; `users.admin` check unchanged                                                                                                                                                                                                                           |
| Add/verify an email on a PIN account     | Firebase email verification                                             | **Removed.** Email exists only when Google or Apple supplies it                                                                                                                                                                                                          |
| Local stack                              | Firebase Auth emulator                                                  | the `games4james-dev` Supabase project (keys in `.env.local`), pglite for data                                                                                                                                                                                           |

Synthetic emails: a PIN account's auth user carries `<username>@pin.games4james.com`. It is never shown, never mailed, never returned by the API, and the domain is ours, so it can never collide with a real address. The `users.email` column keeps meaning "a real email from Google/Apple" and stays null for PIN accounts.

Ids: `users.id` stays `text` and now holds the Supabase user UUID. No foreign key to `auth.users` (the pglite test database has no `auth` schema, and ~640 tests use ids like `u1`).

## T14.0 Supabase Auth configuration (Claude-scripted, MANUAL to finish)

Status: todo
Depends on: T6.1 (done)
Goal: both projects (`games4james`, `games4james-dev`) accept anonymous sign-ins, manual linking, Google (Apple when Phase 10 needs it), issue ES256 tokens, and the keys are in `.env.local` files.
Files: `scripts/supabase-auth-setup.mjs` (new), `docs/supabase-auth-setup.md` (new, replaces `docs/firebase-auth-setup.md`), `apps/*/.env.example`, `scripts/lib/set-env.mjs` (reuse)
Steps:

1. MANUAL (James): in the Supabase dashboard create the second free project **`games4james-dev`** (same region, any password; it holds no data). Create a Supabase **personal access token** (Account → Access tokens) for the script and export it as `SUPABASE_ACCESS_TOKEN` in the terminal only. _Only when social sign-in is switched on later:_ in Google Cloud (any project, no Firebase) make an OAuth consent screen ("Games4James", logo, home page and privacy URLs) and a **Web application OAuth client** with the redirect URIs `https://<prod-ref>.supabase.co/auth/v1/callback` and `https://<dev-ref>.supabase.co/auth/v1/callback`; Apple needs a Services ID and key. Not now.
2. Claude writes `scripts/supabase-auth-setup.mjs`: for each project ref it **PATCHes** `https://api.supabase.com/v1/projects/<ref>/config/auth` (partial update, never `supabase config push`, which overwrites every undeclared setting with the local default) with: anonymous sign-ins on, manual linking on, Google **off** (the script takes `--google` and reads the client id/secret from env for the day the flag flips), `site_url` and the redirect allow-list (`http://localhost:3000/auth/callback`, `http://localhost:3100/auth/callback`, `https://games4james.com/auth/callback`, `https://admin.games4james.com/auth/callback`, the app scheme `com.games4james.app://auth/callback`), email sign-ups off for the email provider (we create those users with the admin API), rate limits left default. It then reads the project's publishable key and URL from `/v1/projects/<ref>/api-keys` and writes `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` into `apps/player-web/.env.local` and `apps/admin-web/.env.local` (dev project), and `SUPABASE_URL` plus `SUPABASE_SECRET_KEY` into `apps/backend-api/.env.local` (dev project), through `scripts/lib/set-env.mjs` so no value is printed. `--prod` does the same for the production refs into a `.env.production.local` nobody reads locally, or just prints the key **names** James has to set in GitHub (T14.7). `--dry-run` prints the PATCH bodies with secrets masked.
3. MANUAL (James): per project, Settings → JWT Keys → "Migrate to JWT signing keys" → create an **ES256** key and make it current (the legacy secret stays valid during rotation). If the Management API exposes this (`/config/auth/signing-keys`), Claude adds it to the script instead.
4. Claude writes `docs/supabase-auth-setup.md`: what the script sets and why, the manual clicks with exact values, the "at relaunch" list (production redirect URLs, Apple provider from Phase 10, GitHub secrets), and how to add the custom auth domain later. Delete `docs/firebase-auth-setup.md` and `scripts/firebase-setup.sh`; update `docs/README.md`.
   Done when: `node scripts/supabase-auth-setup.mjs --dry-run` prints masked bodies for both projects; after the real run `curl -s https://<dev-ref>.supabase.co/auth/v1/.well-known/jwks.json` lists an ES256 key; `git grep -n firebase-setup` is empty; `.env.local` files have the new keys (names checked with `grep -c`).

## T14.1 API: verify Supabase tokens, drop firebase-admin

Status: done in code (2026-10-11). `firebase-admin` gone; `jose` 6.2.12 and `@supabase/supabase-js` 2.117.2 pinned. Bundle: `lambda.mjs` 1.97 MB → 1.59 MB, `bundle.zip` 2.06 MB → 1.82 MB (687 → 490 inputs; ~1.2 MB of the zip is the share-card wasm and fonts). The esbuild banner stays: express still calls `require()` on Node built-ins. Skipped until T14.8: the hand check with a real dev-project token (no dev project yet, T14.0).
Depends on: T14.0 (the dev project's URL; tests do not need it)
Goal: `attachUser` accepts Supabase access tokens and builds the same `AuthUser`; `firebase-admin` is gone from the API.
Files: `apps/backend-api/src/middleware/authGuards.ts`, `src/services/supabaseAuthService.ts` (new, replaces `firebaseAuthService.ts`), `src/config/index.ts`, `src/test/app.ts`, `package.json`, `scripts/bundle.mjs`, `.env.example`
Steps:

1. `npm i jose @supabase/supabase-js -w apps/backend-api`; `npm un firebase-admin -w apps/backend-api`. Config: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (the new `sb_secret_…` key, or the legacy `service_role` JWT; both work with supabase-js), derived `issuer = ${SUPABASE_URL}/auth/v1` and JWKS URL.
2. `supabaseAuthService.ts`: `verifyAccessToken(token)` = `jose.jwtVerify(token, createRemoteJWKSet(jwksUrl), { issuer, audience: "authenticated" })` with the key set created once per container; returns the payload typed as `{ sub, email?, is_anonymous?, app_metadata?: { account_type?, providers? }, role }`. An admin client: `createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })`, exported through small functions used by T14.2 (`setAccountType`, `convertToPinAccount`, `mintSignIn`, `deleteAuthUser`). Keep `hashPin` and `verifyPin` here.
3. `attachUser`: `userId = sub`, `email`, `emailVerified = Boolean(email)` (Google/Apple emails are verified by the provider; PIN accounts have no email), `isAnonymous = is_anonymous === true`, `accountType` from `app_metadata.account_type` with the same fallback to `anonymous`, `providers = app_metadata.providers ?? []`. Reject tokens whose `role` is not `authenticated`. Log only the event name on failure, as now.
4. `src/test/app.ts`: `fakeVerify` returns the new payload shape; `testToken` unchanged, so no test changes elsewhere.
5. Remove `requireVerifiedEmail` if nothing uses it after T14.2 (check with `git grep`).
6. `scripts/bundle.mjs`: drop the `firebase-admin` CommonJS shim comment/banner if it is only there for it; `npm run bundle -w apps/backend-api` and note the new `lambda.mjs` and zip sizes in the task status (expect a large drop from the 18.8 MB node_modules era; the esbuild bundle should fall well under 2 MB zipped).
   Done when: `npm test -w apps/backend-api` green; `npm run typecheck`; `git grep -n firebase apps/backend-api/src` is empty; a hand check with a real token from the dev project (`curl -H "Authorization: Bearer …" localhost:8787/me`) returns 404 for an unknown user and not 401.

## T14.2 API: account flows on Supabase

Status: todo
Depends on: T14.1
Goal: every `/auth/*` route works against Supabase Auth; the email feature is gone; routes lose the `/firebase` segment.
Files: `src/services/userService.ts`, `src/controllers/authController.ts` (renamed from `firebaseAuthController.ts`), `src/routes/auth.routes.ts`, `src/routes/index.ts`, `src/routes/auth.routes.test.ts`, `src/services/throttle.ts` (unchanged), `docs/api.md` if present
Steps:

1. Routes: mount at `/auth` (`/auth/register-anonymous`, `/auth/register-username`, `/auth/login-username`, `/auth/link-provider`, `/auth/change-pin`, `/auth/admin/reset-pin`, `/auth/me`). Keep `/auth/firebase/*` as 410 Gone for one release? No: nothing is deployed, so just drop them.
2. `registerUsername(uid, …)`: after the row is written, `convertToPinAccount(uid, username)` = `admin.updateUserById(uid, { email: syntheticEmail(username), email_confirm: true, app_metadata: { account_type: "username_pin" } })`, then `mintSignIn(email)` = `admin.generateLink({ type: "magiclink", email })` → return `{ user, tokenHash }`. If the auth update fails, roll the row back (wrap in the transaction) so a retry works.
3. `loginWithUsername`: unchanged checks; on success `mintSignIn(syntheticEmail(user.username))` → `{ user, tokenHash }`. The response field is `tokenHash` (not `customToken`).
4. `linkProvider(uid, …)`: `setAccountType(uid, "linked")` instead of `setUserClaims`; email and providers still come from the verified token.
5. `deleteAccount`: `deleteAuthUser(uid)` inside the transaction, same "already gone counts as deleted" rule (`user_not_found` from the admin API).
6. Remove `addEmail`, `syncEmailVerified`, the two routes, `updateFirebaseUserEmail`, `checkEmailVerified`, and the `auth/email-already-exists` branch. Record in DECISIONS: no email is collected from PIN accounts (kid PII; nothing to mail them anyway; recovery stays "ask James", who resets the PIN in the admin).
7. `adminResetPin` unchanged. `scripts/view-custom-claims.ts` → delete or rewrite as `view-auth-user.ts` against the admin API (prints account type and providers only, never email).
8. Tests: the admin client is swapped for a fake in `src/test/app.ts` (`setAuthAdminForTests`), recording calls so the route tests assert `convertToPinAccount` and `generateLink` were called with the synthetic email and that `tokenHash` is returned; `auth.routes.test.ts` renamed and updated; the throttle tests untouched.
   Done when: `npm test -w apps/backend-api` green with the renamed suite; `git grep -n "auth/firebase"` empty across the repo (the player and admin clients are updated in T14.3 and T14.5, so run this check again after them); lint and typecheck clean.

## T14.3 Player web: supabase-js client and the auth provider

Status: todo
Depends on: T14.2
Goal: the app signs in through Supabase with the same screens and the same `useAuth()` surface, so pages and games do not change.
Files: `src/lib/supabase.ts` (new, replaces `lib/firebase.ts`), `src/context/AuthProvider.tsx` (renamed from `FirebaseAuthProvider.tsx`; update every import), `src/pages/login.tsx` (renamed from `firebase-login.tsx`), `src/pages/auth/Callback.tsx` (new), `src/App.tsx`, `src/lib/api.ts`, `src/pages/settings/SettingsScreen.tsx`, `src/utils/errorCode.ts` (+ test), `src/platform/adapters/{web,native}.ts`, `vite.config.ts`, `vite-env.d.ts`, `.env.example`, `package.json`
Steps:

1. `npm i @supabase/supabase-js -w apps/player-web`; `npm un firebase @capacitor-firebase/authentication -w apps/player-web`; remove the root `overrides` entry and `resolve.dedupe: ["firebase"]`.
2. `lib/supabase.ts`: one `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage } })`. `storage` is the SDK storage adapter (localStorage on the web, the Preferences mirror in the apps, from `platform/adapters`), so sessions survive app restarts the way T10.4 intended. Lazy-create it like `initializeFirebase()` so the home page does not pay for it before it is needed.
3. `AuthProvider`: same context type minus `addEmail`, `sendVerificationEmail`, `checkEmailVerified` (`firebaseUser` becomes `session`). Flows:
   - `signInAnonymously` → `auth.signInAnonymously()` → `POST /auth/register-anonymous` → profile.
   - `registerWithUsername` → `POST /auth/register-username` → `auth.verifyOtp({ token_hash, type: "magiclink" })` → profile (same uid, now `is_anonymous: false`).
   - `signInWithUsername` → `POST /auth/login-username` → `verifyOtp` → profile.
   - `signInWithGoogle` / `signInWithApple` (dormant behind `features.socialSignIn`; port the code, no browser check possible until a provider is configured) → web: `auth.signInWithOAuth({ provider, options: { redirectTo: origin + "/auth/callback" } })` (full-page redirect; remember the current path in sessionStorage to return to it); native: T14.4.
   - `linkGoogle` / `linkApple` (guest keeps progress) → web: `auth.linkIdentity({ provider, options: { redirectTo } })`; native: T14.4. On return, `/auth/callback` waits for the session, calls `POST /auth/link-provider`, refreshes the profile, and navigates back.
   - `onAuthStateChange` replaces `onAuthStateChanged`; `getToken` = `(await auth.getSession()).data.session?.access_token` (supabase-js refreshes it itself; `forceRefresh` → `auth.refreshSession()`).
   - `signOut`, `deleteAccount` (`DELETE /me` then `auth.signOut()`), `ensureSession`, `changePin`, `refreshProfile` as today.
4. `/auth/callback` route in `App.tsx` (lazy); `/login` keeps its path. Error mapping in `utils/errorCode.ts`: Supabase `AuthError` has `code` and `status`, never the user's email, but keep the "never show raw messages" rule and map the common codes (`anonymous_provider_disabled`, `otp_expired`, `identity_already_exists`, `over_request_rate_limit`) to kid-friendly text.
5. Settings: remove the email section and its state; keep "Change PIN", "Link Google/Apple", "Delete account".
6. The Capacitor plugin block in `capacitor.config.ts` (`FirebaseAuthentication`) goes; T14.4 adds the replacement.
   Done when: `npm run lint`, `typecheck`, `test`, `format:check` pass; `git grep -n -i firebase apps/player-web/src` is empty; in the Browser pane at 375×812 on the local stack (T14.6): guest sign-in, sign-up with username + PIN keeps the guest's best score, sign out and sign in with the PIN, delete account. (Google sign-in via the redirect is checked only when the flag and a Google client exist.) `npm run web:build` reports the main chunk smaller than before (write the before and after sizes in the status line).

## T14.4 Native Google and Apple sign-in

Status: deferred (2026-10-11: social sign-in is hidden; do the Firebase-removal part of step 3 in T14.3, leave the plugin and the sheets until the flag is turned on)
Depends on: T14.3
Goal: the iOS and Android shells sign in and upgrade guests with native sheets, through Supabase.
Files: `src/platform/adapters/nativeAuth.ts`, `capacitor.config.ts`, `docs/native-setup.md`, `.github/workflows/build-android.yml`, `ios/`, `android/` (generated bits that reference google-services or Firebase plists)
Steps:

1. `npm i @capgo/capacitor-social-login -w apps/player-web` (pin exactly; a version at least two weeks old; Capacitor 8 line). Configure Google (web client id for the id token audience, iOS client id) and Apple in `capacitor.config.ts`.
2. `nativeAuth.ts`: `nativeSignIn(provider)` → plugin login → `auth.signInWithIdToken({ provider, token: idToken, nonce })` (Apple: generate a raw nonce, hash it for the sheet, pass the raw one to Supabase). `nativeLink(provider)` → `auth.linkIdentityWithIdToken({ provider, token, nonce })` if the installed supabase-js has it; otherwise the fallback: sign in with the id token (new uid) and call `POST /auth/merge-guest` with the guest's still-valid access token in the body so the API moves plays, best scores, stats, stickers, XP and remixes from the guest row to the new one, then deletes the guest (new route, tests on pglite). Prefer the first; implement the fallback only if needed and record which in DECISIONS.
3. Remove `google-services.json` / `GoogleService-Info.plist` references from the native projects and the docs (they were Firebase's). `docs/native-setup.md`: the Google Cloud iOS and Android OAuth client ids (added to Supabase's Google provider "authorized client ids"), the Apple Services ID and key for the Supabase Apple provider, and the `com.games4james.app://auth/callback` scheme.
4. `build-android.yml`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` replace the four `VITE_FIREBASE_*` vars.
   Done when: `npm run build:android` (or the workflow) is green; `npx cap sync` has no Firebase pods or Gradle entries; `git grep -n -i "capacitor-firebase\|google-services"` is empty. Manual sheets are checked by James when Phase 10 reaches real devices (T10.8); until then the web fallback in the Browser pane is the proof.

## T14.5 Admin web

Status: todo
Depends on: T14.2
Goal: the admin console signs James in with Google through Supabase.
Files: `apps/admin-web/src/lib/supabase.ts` (replaces `lib/firebase.ts`), `src/context/AdminAuthContext.tsx`, `src/lib/api.ts`, `src/pages/auth/Callback.tsx` or an in-place `detectSessionInUrl` handler, `.env.example`, `package.json`
Steps:

1. Swap the SDK: `signInWithOAuth({ provider: "google", options: { redirectTo: origin + "/" } })`; `detectSessionInUrl` finishes the sign-in on the admin's own page, so no extra route is needed if the app is a single screen. `onAuthStateChange` → `fetchMe` → non-admins are signed out as today.
2. `api.ts` takes the bearer from `auth.getSession()`; the reset-pin call moves to `/auth/admin/reset-pin`.
   Done when: `npm run admin:dev` (local stack) signs in with the dev project; a non-admin Google account is bounced; `git grep -n -i firebase apps/admin-web` empty; lint and typecheck clean.

## T14.6 Local stack and environment

Status: todo
Depends on: T14.3, T14.5
Goal: `npm run local:*` works without the Firebase emulator or Java; the docs say what to put in `.env.local`.
Files: root `package.json` scripts, `.claude/launch.json`, root `CLAUDE.md`, `apps/*/CLAUDE.md`, `apps/*/.env.example`, `docs/plan/ON-RETURN.md` "Try it first"
Steps:

1. Delete `local:auth`; `local:server` keeps `DATABASE_URL=pglite:.local/db` and reads `SUPABASE_URL`/`SUPABASE_SECRET_KEY` from `apps/backend-api/.env.local` (dev project, written by T14.0); `local:web` and `local:admin` drop the `VITE_FIREBASE_*` inline values and rely on `.env.local` for the two `VITE_SUPABASE_*` keys plus `VITE_API_BASE_URL`. Remove the `local-auth` launch config.
2. Note for fully offline work: `supabase start` (Docker) runs a local GoTrue; point the same env names at `http://127.0.0.1:54321`. Documented, not required.
3. Rewrite the env tables in the three `CLAUDE.md` files and the root one ("Auth is Supabase: anonymous, username + PIN, Google, Apple"; local stack no longer needs Java). Update "Things that are deliberately gone": Firebase is gone entirely; the `flingo-fun` project is still deleted in T13.6.
   Done when: a fresh clone with the three `.env.local` files runs `local:server`, `local:web`, `local:admin` and the T14.3 checks pass; `git grep -n -i "emulator"` is empty.

## T14.7 CI/CD, relaunch runbook and the plan

Status: todo
Depends on: T14.1–T14.6
Goal: every pipeline, runbook and plan file says Supabase, and the Firebase leftovers are gone.
Files: `.github/workflows/{deploy-api,deploy-web,deploy-admin,ci}.yml`, `docs/relaunch-log.md`, `docs/plan/13-relaunch.md`, `docs/plan/10-capacitor.md`, `docs/plan/06-sql-data-layer-supabase.md`, `docs/store/{kids-compliance,listing}.md`, `docs/money.md`, `.github/copilot-instructions.md`, `docs/plan/ON-RETURN.md`, `DECISIONS.md`
Steps:

1. `deploy-api.yml`: Lambda env gets `SUPABASE_URL` (variable) and `SUPABASE_SECRET_KEY` (secret) instead of the three `FIREBASE_*` secrets. Try the smaller cold start: measure with the bundle from T14.1 and, if it allows, drop the Lambda back to 256 MB / 5 s (the 512 MB / 10 s was for `firebase-admin`). `deploy-web.yml`, `deploy-admin.yml`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` replace the six `VITE_FIREBASE_*` variables. `ci.yml`: no change unless it listed Firebase names.
2. `docs/relaunch-log.md` and `13-relaunch.md`: T13.3 becomes "Supabase Auth production settings": production redirect URLs and site URL on the `games4james` project, Google client's production origins, Apple if on, the GitHub variables and secrets above; no `auth.games4james.com`, no `__/auth/handler` check. T13.6 keeps "delete `flingo-fun`" and adds "delete the Google Cloud project `flingo-fun` if it only existed for Firebase".
3. `10-capacitor.md` T10.3: point at T14.4. `06-…` T6.0: status "superseded by Phase 14". Store docs: "Supabase Auth (sign-in) and our own API (Supabase Postgres)"; listing's data table "User ID (Supabase uid)".
4. `ON-RETURN.md`: replace the Firebase action with the T14.0 manual steps; the "Try it first" section loses `local:auth`.
5. DECISIONS: the dated entry for this phase (below) is already there; add any sub-decisions made on the way (`linkIdentityWithIdToken` vs merge, Lambda size).
   Done when: `git grep -n -i firebase -- ':!docs/plan/DECISIONS.md' ':!docs/plan/14-supabase-auth.md' ':!docs/archive' ':!docs/plan/06-sql-data-layer-supabase.md' ':!docs/plan/13-relaunch.md'` returns only lines that explain what was removed; CI green on `main`.

## T14.8 End-to-end check and numbers

Status: todo
Depends on: T14.7
Goal: proof that the whole thing works, with the measurements the decision promised.
Steps:

1. Local stack in the Browser pane at 375×812: guest → play → "Save your progress" → username + PIN → best score kept → sign out → PIN sign-in → Settings → friends with a second browser → delete account (row and auth user both gone: check with `view-auth-user.ts`).
2. Admin: sign in, reset a PIN, sign in with the new PIN.
3. `npm run bundle -w apps/backend-api` sizes and a cold-start timing from `npm run server` logs, before (from git history) and after. `npm run web:build` chunk sizes and a Lighthouse run on the preview build (performance was 80–86 with Firebase; expect a few points back).
4. Write the numbers into this file's header and the README status table.
   Done when: all of the above pass; lint, typecheck, tests, format green; Phase 14 marked done in the README.

## Risks and how they are handled

- **`generateLink` for a user whose email provider sign-ups are disabled.** Disabling sign-ups stops `signUp()`; admin-created users and `generateLink` still work. If a project setting blocks it, the fallback is leaving email sign-ups on with "confirm email" on, which does not matter because nobody can reach a sign-up form.
- **Magic-link tokens are single-use and expire (default 1 hour).** The client calls `verifyOtp` immediately; a slow network still has the hour.
- **Redirect sign-in instead of popups on the web.** The user leaves the page and comes back. Sessions and the game state are already persisted (T10.4), and the callback route returns to the page they left.
- **Anonymous sign-in abuse.** Supabase's per-IP limit (30/hour) plus our daily guest clean-up (T6.9) cover it. No CAPTCHA (kids).
- **Google consent shows the Supabase domain** (only once social sign-in is on). Accepted; the US$10/month custom domain is the fix if James wants it.
- **supabase-js version drift** (`linkIdentityWithIdToken`, new key names). T14.4 and T14.0 say what to check; pin exact versions at least two weeks old.
- **Rollback.** Nothing is deployed. `git revert` of the phase's commits brings Firebase back; the plan files for it remain in history.
