# Phase 13: Relaunch

One cutover day, targeted at the first week of December 2026. Until then games4james.com serves the old build and nobody touches it. Everything production-facing that earlier phases set aside lives here, in order. Most of it is MANUAL (James) with Claude preparing exact values; the code work is small.

Gate: Phases 5, 6, 7 and 8 done; T9.1–T9.3 done; T12.1 done; the new-game checklist's Browser pane run passes for every `active` game.

## T13.1 Readiness check

Status: pre-flight run 2026-10-09 (all code gates green; blocked on Phase 8 art and the manual cloud setup), see docs/relaunch-log.md
Depends on: the gate above
Steps: Claude runs the full gate (`npm run lint`, `typecheck`, `test`, `format:check`, all three builds, `generate-seo`), plays every active game once in the Browser pane at 375×812 (run, game over, Play again, mute, pause), checks every screen for "flingo", "Tom" and placeholder copy (`TODO note`), and records the results in `docs/relaunch-log.md`. Anything red blocks T13.2.
Done when: the log shows all green with the commit hash.

## T13.2 Production backend

Status: todo
Depends on: T13.1
Steps:

1. Supabase: the T6.1 project becomes production. Run `npm run db:migrate` and `db:seed` against it one last time from the pipeline (T9.4) and confirm the schema is at the latest migration. Local development switches to pglite / a local Postgres (`apps/backend-api/CLAUDE.md` updated).
2. GitHub secrets: `DATABASE_URL`, `DATABASE_URL_MIGRATIONS`, `SUPABASE_SECRET_KEY` (and the variable `SUPABASE_URL`) for the `games4james` project, `STRIPE_WEBHOOK_SECRET` if T12.2 shipped. Remove the `TABLE_*` variables.
3. Lambda: T9.1's `deploy-api.yml` sets runtime `nodejs24.x`, memory and timeout, and the new env block. MANUAL (James): run it once with `workflow_dispatch` and check `GET /games/config` on api.games4james.com returns the manifest-seeded games.
   Done when: the live API serves the new backend with empty leaderboards.

## T13.3 Supabase Auth production settings (was T3.5; rewritten for Phase 14)

Status: todo
Depends on: T14.8, T13.2
MANUAL (James), on the `games4james` Supabase project, with values from `docs/supabase-auth-setup.md`:

1. `node scripts/supabase-auth-setup.mjs --only prod` (with `--google` and the Google client, because the admin console signs in with Google): site URL `https://games4james.com`, redirect URLs `https://games4james.com/auth/callback` and `https://admin.games4james.com/`, guests and manual linking on, an ES256 signing key.
2. Google Cloud OAuth client (web): redirect URI `https://<prod-ref>.supabase.co/auth/v1/callback`; consent screen name "Games4James", logo, home and privacy URLs.
3. Apple (only if social sign-in is on by then): the Services ID and key under Authentication → Providers → Apple.
4. GitHub: variables `SUPABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; secret `SUPABASE_SECRET_KEY`.
   Done when: `curl -s https://<prod-ref>.supabase.co/auth/v1/.well-known/jwks.json` lists an ES256 key and the GitHub names are set. (No `auth.games4james.com` and no `__/auth/handler`: those were Firebase's.)

## T13.4 Deploy the web and admin, turn auto-deploy on (was T3.6)

Status: todo
Depends on: T13.3
Steps:

1. GitHub variables: `VITE_API_BASE_URL=https://api.games4james.com`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (T13.3), `CORS_ALLOWED_ORIGINS=https://games4james.com,https://admin.games4james.com` (plus the Capacitor origins once Phase 10 ships), analytics id per T7.9. Remove every flingo value.
2. MANUAL (James): CloudFront → attach the link-preview function (`infra/cloudfront/README.md`).
3. Run `deploy-web.yml` and `deploy-admin.yml` by hand once; then Claude uncomments the `push` triggers in all three deploy workflows (T9.1) and updates DECISIONS: auto-deploy is on.
4. Check headers on the live site: `index.html` `no-store`, hashed assets `immutable`, `sw.js` `no-cache`.
   Done when: `curl -s https://games4james.com | grep -c flingo` is 0; `curl -A facebookexternalhit https://games4james.com/games/snapadile` returns the Snapadile static page; the admin signs in.

## T13.5 Launch-day checks

Status: todo
Depends on: T13.4
Steps: in a private window on a phone: anonymous play, create a username+PIN account (and Google sign-in only if `features.socialSignIn` is on by then), submit a score, see it on the leaderboard, rate a game, install the PWA (Lighthouse PWA audit passes, maskable icon shown), share a game link to WhatsApp (per-game card), open `/privacy` and `/support`. MANUAL (James): Google Search Console → add `games4james.com` (DNS verification) → submit `https://games4james.com/sitemap.xml`; Rich Results test on the home page and one game page. Analytics receiving page views (T7.9).
Done when: every item is ticked in `docs/relaunch-log.md` with the date.

## T13.6 Decommission the prototype

Status: todo
Depends on: T13.5, plus 30 days
MANUAL (James), Claude lists the exact console paths:

1. AWS: delete the ten `games4james-*` DynamoDB tables (no export; full reset). Remove the Lambda IAM policy's DynamoDB statement and the `Resource "*"` policy noted in Phase 1.
2. Firebase: delete the `flingo-fun` project (30 days after relaunch, once nothing has pointed at it for a month), and the Google Cloud project `flingo-fun` too if it only existed for Firebase. Nothing in the repo uses Firebase since Phase 14.
3. GitHub: delete the `flingo-fun` repo variables and the old `deploy.yml` if T9.1 left it.
4. Repo: archive `docs/followers-aws-setup.md` and any remaining flingo-era docs under `docs/archive/`; `git grep -i flingo` returns only DECISIONS and the plan history.
   Done when: the AWS and Firebase consoles show nothing from the prototype; DECISIONS has the date.

## T13.7 Tell people

Status: todo
Depends on: T13.5
Steps: the first devlog short (T11.10) is the relaunch one; create the itch.io and Phaser showcase listings (`docs/growth/listings.md`); the family and school loops from the review (grandparents on the leaderboard, a cousin's remix once T11.2 exists). Keep a one-line log of where it was shared and what happened.
Done when: three places link to games4james.com.
