# Games4James

Little games made by James, Tilly and Harvey. A mobile-first web app at https://games4james.com.

This monorepo holds three npm workspaces:

```
apps/
  player-web/   React + Vite + Phaser PWA (the product)
  backend-api/  Express API on AWS Lambda (https://api.games4james.com)
  admin-web/    Moderation and game-config console
docs/plan/      The implementation plan: what to build next, phase by phase
scripts/        Repo-level build and asset scripts
```

Development is done with Claude Code. Start with [CLAUDE.md](CLAUDE.md) and [docs/plan/README.md](docs/plan/README.md). Each app also has its own `CLAUDE.md`.

## Requirements

- Node.js 24 (see `.nvmrc`; `nvm use` picks it up)
- npm 10 or newer
- A filled-in `.env.local` per app, copied from that app's `.env.example`

Run `npm install` once at the repository root.

## Commands

| Command                    | What it does                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| `npm run dev`              | Player web dev server on http://localhost:3000                      |
| `npm run server`           | Backend API on http://localhost:8787                                |
| `npm run admin:dev`        | Admin console on http://localhost:3100                              |
| `npm run web:build`        | Regenerate SEO files and build player web to `apps/player-web/dist` |
| `npm run admin:build`      | Build admin to `apps/admin-web/dist`                                |
| `npm run backend:build`    | Compile the API to `apps/backend-api/dist`                          |
| `npm run build`            | All three builds                                                    |
| `npm run typecheck`        | `tsc --noEmit` in every workspace                                   |
| `npm run lint`             | ESLint across the repo (root `eslint.config.mjs`)                   |
| `npm test`                 | Vitest, all workspaces (root `vitest.config.ts`)                    |
| `npm run web:generate-seo` | Regenerate sitemap and static game pages                            |

## Deployment

`.github/workflows/deploy.yml` is manual-only for now (auto-deploy on push is paused). Run it from GitHub Actions → Deploy Apps → Run workflow, or `gh workflow run deploy.yml --ref main`. It builds and syncs player web and admin to S3 behind CloudFront, and updates the Lambda's code and environment. It authenticates to AWS with GitHub OIDC.

GitHub repository settings it reads:

- Secrets: `AWS_ROLE_TO_ASSUME`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- Variables: `AWS_REGION`, `WEB_S3_BUCKET`, `WEB_CLOUDFRONT_DISTRIBUTION_ID`, `ADMIN_S3_BUCKET`, `ADMIN_CLOUDFRONT_DISTRIBUTION_ID`, `LAMBDA_FUNCTION_NAME`, `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS`, and the six `VITE_FIREBASE_*` values

Plan Phase 9 splits this into gated, path-filtered pipelines.

## Links

- Phaser documentation: https://newdocs.phaser.io
