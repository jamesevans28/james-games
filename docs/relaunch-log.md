# Relaunch log

Results of the Phase 13 checks ([plan](plan/13-relaunch.md)), newest first. Anything red blocks the cutover.

## 2026-10-11: first production deploy (in progress)

James asked to deploy ahead of the December relaunch, with placeholder art.

| Step                                                                                                                                                                 | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub variables `SUPABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `CORS_ALLOWED_ORIGINS` (flingo origins removed); secret `SUPABASE_SECRET_KEY` | set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Deploy API (migrate, seed, Lambda)                                                                                                                                   | pass; `https://api.games4james.com/games/config` lists the games, `/auth/me` without a token is 401                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Deploy player web                                                                                                                                                    | **went to the wrong place.** The repo variables `WEB_S3_BUCKET=flingo.fun` and `WEB_CLOUDFRONT_DISTRIBUTION_ID=E2771LICEYC6NY` are the dead flingo.fun site. games4james.com is distribution `E12798GMFCPMYZ` serving the bucket **`james4games.com`** (the words are swapped in the bucket name). The deploy role's policy already allows that bucket. Fix: set the two variables to those values and rerun Deploy player web. Until then the old January build on games4james.com calls `/auth/firebase/*`, which the new API no longer has, so sign-in and score saving are down. |
| Deploy admin                                                                                                                                                         | pass to bucket `admin.games4james.com`, but **`admin.games4james.com` has no DNS record**. It needs a Route 53 alias to distribution `E39HIICFU5SSXX`. The admin also needs the mail server before anyone can sign in.                                                                                                                                                                                                                                                                                                                                                               |

## 2026-10-09: pre-flight (T13.1 dry run, before the art and the cloud accounts)

Commit `d6a0561` on `feat/phase12-support`.

| Check                                                                                                                        | Result                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `npm run lint` (0 errors)                                                                                                    | pass                                           |
| `npm run typecheck`                                                                                                          | pass                                           |
| `npm test`                                                                                                                   | pass (all projects)                            |
| `npm run format:check`                                                                                                       | pass                                           |
| `npm run web:build` (includes `generate-seo`)                                                                                | pass                                           |
| `npm run admin:build`                                                                                                        | pass                                           |
| `npm run backend:build` and `npm run bundle -w apps/backend-api`                                                             | pass (0.9 MB zip)                              |
| `git grep -i flingo` in apps, scripts, infra                                                                                 | clean (the old Phase 3 codemod deleted)        |
| "Tom" or `TODO note` in the app                                                                                              | none                                           |
| End to end on the local stack (emulator + pglite): sign up, play, score, leaderboard, settings, friends page, delete account | pass                                           |
| Every active game played once at 375×812                                                                                     | **not yet**: redo after the Phase 8 art lands  |
| Covers pass `node scripts/art/check.mjs`                                                                                     | **red**: covers are the old SVG/JPG until T8.4 |

Blocking the real T13.1: Phase 8 art (T8.4 covers at least), James's T6.0/T6.1 cloud setup, T12.1 Ko-fi page.

## Relaunch-day runbook (T13.2 to T13.5), in order

Claude prepared everything below. Steps marked **James** need the consoles.

1. **T13.1:** Claude reruns the table above on `main` and plays every active game. All green, or stop.
2. **T13.2 production backend:**
   - **James:** confirm the GitHub secrets `DATABASE_URL`, `DATABASE_URL_MIGRATIONS` and `SUPABASE_SECRET_KEY`, and the variable `SUPABASE_URL` (the `games4james` project). Delete the old repo variable `TABLE_NAME` and any other `TABLE_*` ones.
   - **James:** Actions → **Deploy API** → Run workflow (`migrate_only` unticked).
   - Check it:
     ```bash
     curl -s https://api.games4james.com/games/config | head -c 300
     ```
     This should list the manifest games, and leaderboards should be empty.
3. **T13.3 Supabase Auth production settings:** already applied by the setup script on `games4james`, and the JWKS lists an ES256 key (checked 2026-10-11). **James:** add the secret `SUPABASE_SECRET_KEY`. Before anyone signs in by email code, the admin included, set up the mail server ("Email delivery" in [supabase-auth-setup.md](supabase-auth-setup.md)). Check:
   ```bash
   curl -s https://<prod-ref>.supabase.co/auth/v1/.well-known/jwks.json
   ```
   This should list an ES256 key.
4. **T13.4 web and admin:**
   - GitHub variables `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `CORS_ALLOWED_ORIGINS` are set (2026-10-11).
   - **James:** CloudFront → Functions → attach `bot-rewrite` ([infra/cloudfront/README.md](../infra/cloudfront/README.md)).
   - **James:** run **Deploy player web** and **Deploy admin** once by hand.
   - **Claude:** uncomment the `push` triggers in `deploy-web.yml`, `deploy-admin.yml` and `deploy-api.yml`, and record "auto-deploy on" in DECISIONS.
   - Checks:
     ```bash
     curl -s https://games4james.com | grep -c flingo
     ```
     This should print 0.
     ```bash
     curl -sI https://games4james.com/index.html | grep -i cache-control
     ```
     This should be `no-store`.
     ```bash
     curl -s -A facebookexternalhit https://games4james.com/games/snapadile | grep -o "<title>[^<]*"
     ```
     This should be the Snapadile page title.
5. **T13.5 launch-day checks**, on a phone in a private window:
   - [ ] play as a guest
   - [ ] create username + PIN
   - [ ] admin: James signs in with an emailed code and resets a test PIN (needs the mail server)
   - [ ] score, then the leaderboard
   - [ ] rating after 3 plays
   - [ ] install the PWA
   - [ ] share a game link to WhatsApp
   - [ ] `/privacy`, `/parents`, `/support`
   - [ ] **James:** Search Console → add `games4james.com` → submit `/sitemap.xml`
   - [ ] Cloudflare Web Analytics shows page views
6. **T13.6, 30 days later (James):**
   - AWS → DynamoDB → delete the ten `games4james-*` tables.
   - IAM → the Lambda role → remove the DynamoDB statement.
   - Firebase → delete the `flingo-fun` project (and its Google Cloud project if it only existed for Firebase).
   - GitHub → delete any `flingo` variables.
