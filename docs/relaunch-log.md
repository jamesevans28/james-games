# Relaunch log

Results of the Phase 13 checks ([plan](plan/13-relaunch.md)), newest first. Anything red blocks the cutover.

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
   - **James:** confirm the GitHub secrets `DATABASE_URL`, `DATABASE_URL_MIGRATIONS`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` (the `games4james` project). Delete the old repo variable `TABLE_NAME` and any other `TABLE_*` ones.
   - **James:** Actions → **Deploy API** → Run workflow (`migrate_only` unticked).
   - Check it:
     ```bash
     curl -s https://api.games4james.com/games/config | head -c 300
     ```
     This should list the manifest games, and leaderboards should be empty.
3. **T13.3 Firebase production settings (James):** follow "At relaunch" in [firebase-auth-setup.md](firebase-auth-setup.md). That's the `auth.games4james.com` custom domain, the OAuth client origins and redirect, and Apple if it's on. Check `https://auth.games4james.com/__/auth/handler` loads.
4. **T13.4 web and admin:**
   - **James:** set the GitHub variables `VITE_API_BASE_URL=https://api.games4james.com`, the six `VITE_FIREBASE_*` for `games4james` with `VITE_FIREBASE_AUTH_DOMAIN=auth.games4james.com`, and `CORS_ALLOWED_ORIGINS=https://games4james.com,https://admin.games4james.com`.
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
   - [ ] Google sign-in shows "Games4James"
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
   - Firebase → delete the `flingo-fun` project.
   - GitHub → delete any `flingo` variables.
