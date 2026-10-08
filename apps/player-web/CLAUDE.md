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

| Folder        | What lives there                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pages/`      | Route screens: `home/HomeFeed`, `games-list`, `games/` (PlayGame, GameLanding, GameOver, GameHeader), `leaderboard`, `profile`, `settings`, `followers`, `notifications`, `firebase-login` |
| `components/` | Shared UI: layout (Header, RootLayout), SideDrawer, overlays (Splash, Install, SW update, Streak), `feed/GameTile`                                                                         |
| `context/`    | `FirebaseAuthProvider.tsx`: auth state, profile, all auth flows                                                                                                                            |
| `hooks/`      | Feed ordering (`useFeedAlgorithmV2`), catalog, presence, online status                                                                                                                     |
| `lib/`        | `api.ts` (backend client, bearer token), `firebase.ts` (SDK init)                                                                                                                          |
| `games/`      | One folder per game plus `index.ts`, the registry                                                                                                                                          |
| `game/`       | Phaser-agnostic shared helpers: `ui/dpad.ts`, `ui/onScreenKeyboard.ts`, `words/` dictionary                                                                                                |
| `utils/`      | Analytics, `playHistory.ts`, `errorCode.ts`, share links, SEO keywords                                                                                                                     |
| `platform/`   | The Game SDK: `sdk.ts` (contract), `registry.ts`, `host.ts`, `mount.ts`, `scenes/`, `hud/`, `input/`, `audio/`, `storage/`. See its README                                                 |
| `config/`     | `env.ts` (API origin), `brand.json` + `brand.ts` (every brand string, colour, path)                                                                                                        |

Routes are defined in `src/App.tsx`.

## Games and the SDK

A game is a folder `src/games/<id>/` with a `manifest.ts` (`defineGame`) and an `index.ts` exporting `create(host, el)`. The registry (`src/platform/registry.ts`) picks it up; there is nothing to register by hand. **Read `src/platform/README.md` before touching a game**, and follow `docs/plan/templates/new-game-checklist.md` for a new one.

- Every active game is on the SDK (Phase 5). The five inactive games keep only their manifests; their old code is archived in `docs/archive/games/` and is not compiled.

## Environment variables

Copy `.env.example` to `.env.local` (gitignored). Never commit values.

| Variable                                                                                                     | Meaning                                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`                                                                                          | Backend origin. Local `http://localhost:8787`, prod `https://api.games4james.com`                        |
| `VITE_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | Firebase web app config (project `games4james` from T6.0; the prototype's `flingo-fun` is being retired) |
| `VITE_FIREBASE_MEASUREMENT_ID`                                                                               | Optional analytics id                                                                                    |

CI sets the same names from GitHub repo variables plus `VITE_BUILD_NUMBER`.

## Gotchas

- Brand values live in `src/config/brand.json` (read by `vite.config.ts`, `vite/brandHtml.ts` and repo scripts) and are exported with helpers from `src/config/brand.ts`. `index.html` uses `%BRAND.key%` placeholders.
- Colours are semantic tokens from `src/index.css` (`paper`, `paper-2`, `card`, `line`, `ink`, `ink-2`, `ink-3`, `edge`, `scrim`, `brand`, `accent`, `on-brand`, `on-accent`, and the crayons `tomato`, `sun`, `grass`, `sky`, `grape`). The default Tailwind palette is switched off, so `bg-gray-100` silently does nothing. Dark mode redefines the same tokens. Canvas code uses `BRAND_COLORS`/`BRAND_FONTS` from `brand.ts`.
- localStorage keys use the `g4j:` prefix; see `src/utils/storageKeys.ts`.
- Phaser 4 is the baseline (4.2.1 since T2.7). No v3 pipeline, FX or mask APIs. Group children are a native Set: use `group.getChildren()` (a fresh array, safe to remove while looping). Fill tint is `setTint(c).setTintMode(Phaser.TintModes.FILL)` and `clearTint()` does not reset the mode. `Math.TAU` is 2π. Migration guide: node_modules/phaser/skills/v3-to-v4-migration/SKILL.md.
- `vite.config.ts` holds the PWA manifest and service-worker caching rules (one config for dev and build; set `VITE_SW_DEV=1` to run the service worker in dev). Never cache an authenticated endpoint (see T1.5).
- Best scores are `g4j:best:<gameId>` via `src/platform/storage/bestScore.ts`; games read them with `host.best.get()` and the platform saves them.
- SDK games (T4.4+) expose the running `Phaser.Game` as `window.__g4jGame` in dev. When the Browser pane is hidden (`document.visibilityState === "hidden"`), Phaser's requestAnimationFrame loop never ticks. To test anyway, run `const l = __g4jGame.loop; l.raf.stop(); l.raf.start(l.step.bind(l), true, 16)` in the page to drive it with timers.
