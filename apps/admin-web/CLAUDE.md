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
- `context/AdminAuthContext.tsx`: sign-in with a 6-digit code Supabase emails to the admin's address (Google is in the code, hidden by `src/config.ts`); admin status comes from `GET /me` (`users.admin`), never from the token. The address is attached in the player app (Settings → "A grown-up's email").
- `routes/RequireAdmin.tsx`: route guard.
- `lib/api.ts`: client for the `/admin/*` routes. `lib/supabase.ts`: the Supabase Auth client (`@supabase/auth-js`).

## Environment variables

`.env.local` (gitignored, see `.env.example`) uses the same names as player-web: `VITE_API_BASE_URL`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (`games4james`, or `games4james-dev` once it exists; written by `scripts/supabase-auth-setup.mjs`). CI sets them from GitHub repo variables.

## Moderation

The users drawer can reset a screen name to a generated one, disable or enable an account, and delete a single play (best scores are recomputed). Games are read-only apart from their `metadata` (manifests own everything else).
