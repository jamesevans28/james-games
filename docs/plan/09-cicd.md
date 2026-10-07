# Phase 9: CI/CD

Goal: every push to `main` runs gates (lint, typecheck, tests, manifest/art checks) and auto-deploys only the apps whose files changed; pull requests get the same gates without deploying. Database migrations run in the pipeline. Everything stays on free tiers (GitHub Actions free minutes for public repos are unlimited; for a private repo 2,000 min/month, which is plenty with path filters).

Start T9.1 right after Phase 1; finish T9.4–T9.6 alongside Phase 6.

## T9.1 Split the workflow: `ci.yml` (gates) and `deploy-*.yml` (per app)
Status: todo
Depends on: T1.8 (typecheck), later T4.1/T4.2 add lint/test steps
Files: `.github/workflows/ci.yml`, `deploy-web.yml`, `deploy-admin.yml`, `deploy-api.yml`, delete `deploy.yml`
Steps:
1. `ci.yml`: on `pull_request` and `push` to `main`: checkout, Node from `.nvmrc`, `npm ci`, `npm run typecheck`, `npm run lint` (once T4.1), `npm test` (once T4.2), `npm run web:build`, `npm run admin:build`, `npm run backend:build`, `node scripts/art/check.mjs` (once T8.3). Cache `~/.npm`.
2. `deploy-web.yml`: on `push` to `main` with `paths: [apps/player-web/**, scripts/**, package*.json]` and `workflow_dispatch`; `needs` a reusable gate job (call `ci.yml` via `workflow_call`) then the existing S3 sync + cache headers + CloudFront invalidation. Invalidate only `/index.html`, `/sitemap.xml`, `/static-games/*` and `/manifest.webmanifest` instead of `/*` (hashed assets don't need it; keeps CloudFront free-tier invalidations low).
3. `deploy-admin.yml`: same for `apps/admin-web/**`.
4. `deploy-api.yml`: for `apps/backend-api/**`: build, prod-only install, zip, `update-function-code`, wait, then `update-function-configuration` with runtime `nodejs24.x` (or `nodejs22.x` if 24 isn't offered in the region) and the env block. Secrets via GitHub secrets as today; after Phase 6 the env includes `DATABASE_URL` and `DATA_BACKEND`.
5. Concurrency groups per workflow so overlapping pushes cancel older runs.
Also (found in T2.1): the Lambda runs on 128 MB with a 3 s timeout; raise to at least 512 MB / 10 s when moving the runtime to nodejs24.x, and check cold-start times.
Done when: a docs-only PR runs `ci.yml` only; a change to `apps/player-web` deploys only the web; all three deploys succeed from `main`.

## T9.2 Branch protection and PR template
Status: todo
Depends on: T9.1
MANUAL (James): GitHub → Settings → Branches → protect `main`: require the `ci` check, require a PR (James can self-merge), no force-push. Claude confirms the PR template from T0.7 renders.
Done when: a PR shows the `ci` check as required.

## T9.3 Lambda bundle size and cold start
Status: todo
Depends on: T2.6
Steps: bundle the API with `esbuild` (`--platform=node --target=node24 --bundle --minify --external:@aws-sdk/*`) to a single `dist/lambda.js` instead of zipping `node_modules`; measure zip size (target < 3 MB) and cold start (CloudWatch `Init Duration`, target < 800 ms). Update `deploy-api.yml`.
Done when: zip < 3 MB; routes still respond; init duration recorded in the PR.

## T9.4 Database migrations in the pipeline
Status: todo
Depends on: T6.2
Steps: in `deploy-api.yml`, before deploying the function: `npm run db:migrate` with `DATABASE_URL_MIGRATIONS` secret, then `npm run db:seed` (idempotent upserts of games and levels from the manifests export). Fail the deploy if migration fails. Add a `migrate-only` `workflow_dispatch` input.
Done when: a PR adding a column deploys and the column exists in Supabase.

## T9.5 Scheduled jobs
Status: todo
Depends on: T6.9
Files: `.github/workflows/scheduled.yml`
Steps: weekly `db-ping` (keep-alive), daily housekeeping (presence cleanup, stale anonymous users), weekly Dependabot is separate (T2.8). All with `workflow_dispatch`.
Done when: both jobs have run green once.

## T9.6 Nightly backup to S3
Status: todo
Depends on: T6.5
Steps: nightly `pg_dump` (via `postgres:17` container in the job) of the Supabase DB, gzip, upload to an S3 bucket `games4james-backups` with a 30-day lifecycle rule (MANUAL: James creates the bucket and lifecycle rule; Claude writes the CLI). Uses the existing OIDC role (add `s3:PutObject` on that bucket).
Done when: a backup object appears in S3; a restore to a scratch Supabase project is tested once and documented.

## T9.7 Preview deploys for PRs (optional)
Status: todo (optional)
Steps: on `pull_request` touching `apps/player-web`, upload the build as a workflow artifact and post a comment with the artifact link (zero infra). If James wants live previews later, Cloudflare Pages free tier can host PR previews; note in `DECISIONS.md` if adopted.
Done when: PRs show the artifact link.

## T9.8 Capacitor builds in CI (groundwork)
Status: todo
Depends on: T10.2
Steps: `build-android.yml` on `workflow_dispatch` and tags `v*`: build web, `npx cap sync android`, Gradle assembleRelease (unsigned or with a signing key in secrets), upload the APK/AAB artifact. iOS builds need macOS runners (10× minutes on private repos; free on public) or local Xcode; document the local `npx cap open ios` → Archive flow for James instead, and add the CI job only if the repo is public.
Done when: an Android AAB artifact is produced from a tag.

## T9.9 Release tagging and changelog
Status: todo
Depends on: T9.1
Steps: adopt conventional commits (already in CLAUDE.md); add `release-please` (free GitHub app) or a simple `npm version` + tag workflow that generates `CHANGELOG.md` and a GitHub release per merge batch; the version shows in the drawer ("Build 1.3.0 · abc123") via `VITE_BUILD_NUMBER` + `VITE_GIT_SHA`.
Done when: a release exists with notes; the drawer shows the version.
