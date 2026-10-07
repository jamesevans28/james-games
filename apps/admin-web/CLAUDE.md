# admin-web

A small React 19 + React Query + Tailwind 4 console for James. Its job is **moderation and game config only**; keep it small. Read the root `CLAUDE.md` and `docs/plan/README.md` first.

## Commands (from the repo root)

```bash
npm run admin:dev     # http://localhost:3100
npm run admin:build   # tsc -b && vite build → apps/admin-web/dist
```

It needs the backend running (`npm run server`) and an account whose user row has `admin: true`.

## Structure (`src/`)

- `pages/`: `HomePage` (dashboard), `UsersPage`, `GamesPage`, `LoginPage`.
- `components/`: layout (Sidebar, TopBar), `users/UserDrawer`, `games/GameDrawer`, `games/CreateGameModal`.
- `context/AdminAuthContext.tsx`: Google sign-in via Firebase; admin status comes from `GET /me`.
- `routes/RequireAdmin.tsx`: route guard.
- `lib/api.ts`: client for the `/admin/*` routes. `lib/firebase.ts`: SDK init.

## Environment variables

`.env.local` (gitignored) uses the same names as player-web: `VITE_API_BASE_URL` and the six `VITE_FIREBASE_*` values. CI sets them from GitHub repo variables.

## Known issues (fixed in the plan)

- The dashboard scans whole tables; Phase 6 (T6.8) replaces this with SQL aggregates and adds moderation actions.
