# player-web

The product: a React 19 + Vite + Tailwind 4 PWA that hosts Phaser mini-games. Read the root `CLAUDE.md` and `docs/plan/README.md` first.

## Commands (from the repo root)

```bash
npm run dev          # http://localhost:3000 (vite.config.ts)
npm run web:build    # regenerates SEO files, then vite build → apps/player-web/dist
npm run typecheck    # tsc --noEmit for every workspace
```

Check UI in the Browser pane with the `player-web` launch config at a 375×812 viewport. Leaderboards and ratings stay empty unless `npm run server` is also running.

## Folder map (`src/`)

| Folder | What lives there |
|---|---|
| `pages/` | Route screens: `home/HomeFeed`, `games-list`, `games/` (PlayGame, GameLanding, GameOver, GameHeader), `leaderboard`, `profile`, `settings`, `followers`, `notifications`, `firebase-login` |
| `components/` | Shared UI: layout (Header, RootLayout), SideDrawer, overlays (Splash, Install, SW update, Streak), `feed/GameTile` |
| `context/` | `FirebaseAuthProvider.tsx`: auth state, profile, all auth flows |
| `hooks/` | Feed ordering (`useFeedAlgorithmV2`), catalog, presence, online status |
| `lib/` | `api.ts` (backend client, bearer token), `firebase.ts` (SDK init) |
| `games/` | One folder per game plus `index.ts`, the registry |
| `game/` | Phaser-agnostic shared helpers: `ui/dpad.ts`, `ui/onScreenKeyboard.ts`, `words/` dictionary |
| `utils/` | Analytics, `gameEvents.ts` (game → React events), `playHistory.ts`, `errorCode.ts`, share links, SEO keywords |
| `platform/` | Arrives in Phase 4: the Game SDK (host, mount, base scene, HUD/input/audio kits) |
| `config/` | Arrives in Phase 1/3: `env.ts`, `brand.ts` |

Routes are defined in `src/App.tsx`.

## How a game is registered today

1. Folder `src/games/<id>/` with `index.ts` exporting `mount(container) → { destroy() }`.
2. An entry in `src/games/index.ts` with `id`, `title`, copy, `thumbnail`, `xpMultiplier`, dates and a lazy `load()`.
3. Assets in `public/assets/<id>/`.
4. The scene calls `dispatchGameOver({ gameId, score })` from `utils/gameEvents.ts`; `PlayGame.tsx` shows `GameOver.tsx`, which posts the score.

Phase 4 replaces this with `manifest.ts` + `create(host, el)`. New games after Phase 4 must use the SDK.

## Environment variables

Copy `.env.example` to `.env.local` (gitignored). Never commit values.

| Variable | Meaning |
|---|---|
| `VITE_API_BASE_URL` | Backend origin. Local `http://localhost:8787`, prod `https://api.games4james.com` |
| `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | Firebase web app config (project `flingo-fun`) |
| `VITE_FIREBASE_MEASUREMENT_ID` | Optional analytics id |

CI sets the same names from GitHub repo variables plus `VITE_BUILD_NUMBER`.

## Gotchas

- Brand strings still say flingo in many files. Phase 3 moves them into `src/config/brand.ts`; until then don't add new ones.
- The Phaser version is 3.90 until Phase 2 (T2.7) moves to Phaser 4.
- `vite.config.ts` holds the PWA manifest and service-worker caching rules (one config for dev and build; set `VITE_SW_DEV=1` to run the service worker in dev). Never cache an authenticated endpoint (see T1.5).
- Best scores live in localStorage under inconsistent keys until T1.10.
