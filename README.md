# James Games Monolith

James Games is now structured as a single npm workspace that houses the player-facing web hub, the Express/Lambda backend, and a placeholder admin console. Shared documentation, scripts, and infrastructure live at the repository root while each app has its own build tooling under `apps/`.

```
apps/
  player-web/   <-- React + Phaser experience customers use today
  backend-api/  <-- Express server bundled for AWS Lambda
  admin-web/    <-- React placeholder for the future operations console
docs/
scripts/
```

## Requirements

- Node.js 20+
- npm 10+ (npm workspaces)
- AWS credentials for backend/dev commands where required

Run `npm install` once at the repo root to install dependencies for every workspace.

## App Commands

| Area        | Dev Server                                        | Production Build                                           |
| ----------- | ------------------------------------------------- | ---------------------------------------------------------- |
| Player web  | `npm run web:dev`                                 | `npm run web:build` (outputs to `apps/player-web/dist`)    |
| Backend API | `npm run backend:dev` (local Express/Lambda shim) | `npm run backend:build` (emits to `apps/backend-api/dist`) |
| Admin web   | `npm run admin:dev`                               | `npm run admin:build`                                      |

Additional helpers:

- `npm run web:asset:snapadile`
- `npm run web:asset:car-crash`
- `npm run web:generate-sitemap`

These scripts rely on the shared `scripts/` folder and write into `apps/player-web/public/assets`.

## Player Web (apps/player-web)

- React + Vite frontend that mounts Phaser mini-games located in `apps/player-web/src/games/*`.
- Assets are served from `apps/player-web/public/assets/[gameId]/`.
- Tailwind/PostCSS config is scoped to the directory so multiple apps can evolve independently.
- Use `npm run web:dev` while working on games; Vite runs on port `3000` by default.

## Backend API (apps/backend-api)

- Express app compiled to Lambda-compatible handlers via `npm run backend:build`.
- Development server (`backend:dev`) spins up the lambda adapter defined in `src/dev-server.ts`.
- Experience/leveling data lives under `apps/backend-api/src/data/experienceLevels.ts`. Override defaults by setting `TABLE_EXPERIENCE_LEVELS` in your `.env.local` inside this package.

New/important routes:

- `POST /experience/runs` – record one session and award XP
- `GET /experience/summary` – return the caller’s progress snapshot

User rows store `xpLevel`, `xpProgress`, `xpTotal`, and `xpUpdatedAt`. Existing accounts are upgraded lazily the first time XP is recorded.

## Admin Web (apps/admin-web)

React Vite shell that currently displays a placeholder screen. Use it as the foundation for moderation dashboards, release controls, etc. The app reserves port `3100` in dev mode.

## Deploying the Player App

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds `apps/player-web` with Vite and syncs the resulting `dist/` folder to S3 using GitHub OIDC. Configure the following secrets/variables:

- `AWS_ROLE_TO_ASSUME`
- `AWS_REGION`
- `S3_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID` (optional)

The workflow installs dependencies, runs `npm run web:build`, and `aws s3 sync`s the output. `index.html` is re-uploaded with `Cache-Control: no-store` before optionally invalidating CloudFront.

## Development Tips

- All shared docs and scripts stay at the repository root. App-specific configs (Vite, Tailwind, tsconfig, etc.) sit next to their respective source code under `apps/*`.
- Phaser games dispatch UI events through `apps/player-web/src/utils/gameEvents.ts`. Prefer central utilities over per-game globals.
- When creating a new game, update `apps/player-web/src/games/index.ts` and remember to bump the `updatedAt` field for the entry.

## Experience & Leveling Surfacing

- The frontend shows XP progress inside score dialogs, profile, followers, and leaderboards.
- Ensure backend routes above are deployed before rolling out new XP-driven UI to production.

## Support & Community

- Phaser documentation: [https://newdocs.phaser.io](https://newdocs.phaser.io)
- Questions? Open an issue in this repo or contact the James Games team.
