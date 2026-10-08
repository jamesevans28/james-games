# Phase 4: Game SDK, linting and tests

The single most valuable refactor. After this phase, a game is a manifest plus a `create(host, el)` function; the platform owns mounting, HUD, input, audio, storage, scoring hand-off and restart. Lint and tests are introduced here because the SDK is the first code that must be covered.

Target layout:

```
apps/player-web/src/platform/
  sdk.ts              GameManifest, GameHost, GameInstance, GameModule, defineGame()
  host.ts             createHost(): wires storage, audio, haptics, analytics, rng, gameOver
  mount.ts            createGameMount(): Phaser.Game config from manifest, scene wiring, destroy
  registry.ts         import.meta.glob('../games/*/manifest.ts') → sorted GameMeta[]
  scenes/BasePlatformScene.ts   HUD, pause on blur, resize policy, shutdown cleanup, endRun()
  hud/                score/best text, hearts, timer, popups, countdown, confirm modal
  input/              tapZones(), holdZones(), swipe(), dpad() (moved from game/ui), keyboard mirror
  audio/              one AudioContext, beep/ding/thud/pop, mute, kids' recorded SFX loader
  storage/            bestScore, namespaced local storage with versioning
  textures/           generated particle/spark/droplet textures
  fonts.ts            BRAND_FONTS from brand.ts, preload helper
apps/player-web/src/games/<id>/
  manifest.ts         defineGame({...})
  index.ts            export const create = (host, el) => createGameMount(host, el, { scenes: [...] })
  scenes/, useCases/, entities/, adapters/
```

## T4.1 ESLint 10 flat config, Prettier, scripts

Status: todo
Depends on: Phase 2 complete
Goal: `npm run lint` runs across all workspaces and is clean; formatting is automatic.
Files: `eslint.config.js` (root), `.prettierrc`, `.prettierignore`, root and workspace `package.json`, `.vscode/settings.json` (optional), `.github/workflows/*` (gate added in Phase 9)
Steps:

1. `npm i -D eslint@latest typescript-eslint@latest eslint-plugin-react-hooks@latest eslint-plugin-react-refresh@latest eslint-config-prettier prettier globals -w .` (root).
2. One root `eslint.config.js` using `typescript-eslint` recommended-type-checked for `apps/*/src/**/*.{ts,tsx}`, react-hooks for the two web apps, node globals for backend and scripts. Rules to add: `no-console` (`warn`/`error` allowed), `@typescript-eslint/no-explicit-any: error`, `no-restricted-imports` banning `../utils/gameEvents` and direct `localStorage` from `src/games/**` (games must use the host), `no-restricted-globals` for `window.location` in games.
3. Scripts: root `lint` → `eslint .`, `lint:fix`, `format` → `prettier --write .`, `format:check`.
4. Run `lint:fix` once, then fix the rest by hand. Where the existing games violate the game-only rules, add a file-level `/* eslint-disable */` with `// TODO T5.x` so the rule applies to new code immediately and old games are cleaned in Phase 5.
   Done when: `npm run lint` and `npm run format:check` exit 0.

## T4.2 Vitest setup and first tests

Status: todo
Depends on: T4.1
Goal: `npm test` runs Vitest across workspaces with coverage on pure logic.
Files: `vitest.workspace.ts` (root), `apps/*/vitest.config.ts`, `apps/*/src/**/*.test.ts`
Steps:

1. `npm i -D vitest@latest @vitest/coverage-v8 jsdom -w .`. Root `vitest.workspace.ts` lists the three apps; web apps use `environment: "jsdom"`, backend `node`.
2. Scripts: `test` → `vitest run`, `test:watch`, `test:coverage`.
3. First tests (write them even if small): `utils/bestScore.test.ts`, `utils/playHistory.test.ts`, `games/box-cutter/useCases/captureFill.test.ts`, `games/box-cutter/useCases/score.test.ts`, `game/words/scrabble.test.ts`, backend `services/experienceService.test.ts` (xp calc), `streakService.test.ts`, `scoresService.test.ts` (validation), `lib/log.test.ts` (PII refusal).
4. Coverage threshold: 80% lines for `src/platform/**`, `src/game/**`, `src/games/**/useCases/**`, backend `src/services/**` (set in config; CI enforces in Phase 9).
   Done when: `npm test` passes with ≥ 10 test files; coverage report generated.

## T4.3 SDK types and `defineGame`

Status: done (2026-10-08). `platform/sdk.ts` holds the types and `defineGame`. `platform/manifestSchema.ts` holds the zod schema, which is tests-only so zod never ships, plus a compile-time check that schema and type agree. `platform/manifest.test.ts` validates every manifest (folder = id, unique, cover and sfx files exist) and checks a broken fixture fails. Changes from the step list: `seo` is `{ description, category }` (meta keywords were dropped in T3.4), `cover` may be SVG until Phase 8, `GameResult` has no duration because the platform measures it, and `safeArea()` is a function.
Depends on: T4.2
Goal: the contract every game implements.
Files: `apps/player-web/src/platform/sdk.ts`
Steps:

1. Define (see the review for the full shape):
   - `GameManifest`: `id`, `title`, `tagline`, `description`, `objective`, `controls`, `makers: string[]`, `note?: string`, `status: "active" | "inactive" | "beta"`, `orientation: "portrait"`, `design: { w: 540, h: 960 }`, `input: InputKind[]`, `scoring: { max: number; perSecondMax: number; xpMultiplier: number }`, `cover: string` (path), `createdAt`, `updatedAt`, `seo: { keywords: string[] }`, `remix?: RemixKnob[]` (Phase 11).
   - `GameHost`: `gameOver(result)`, `best`, `audio`, `haptics`, `rng(seed?)`, `safeArea`, `analytics`, `fonts`, `colors`, `isPaused()`.
   - `GameInstance`: `start()`, `pause()`, `resume()`, `restart()`, `destroy()`, `setMuted(b)`.
   - `GameModule = { manifest; create(host, el): GameInstance }`.
   - `defineGame(manifest)` validates with zod at build time (test) and returns the typed manifest.
2. Add `scripts/validate-manifests.mjs` (or a Vitest test) that imports every `games/*/manifest.ts` and checks ids are unique, cover files exist, `scoring.max` > 0.
   Done when: types compile; the manifest test runs and fails on a deliberately broken manifest.

## T4.4 Host and mount

Status: done (2026-10-08). New: `platform/host.ts`, `controller.ts`, `mount.ts`, `rng.ts` and `storage/bestScore.ts` (`utils/bestScore.ts` is a re-export shim until T5.13). The host measures the run without paused time, takes one `gameOver` per run, and saves the best before telling React. `controlGame` is Phaser-free, so it is unit-tested with a fake game. Reflex Ring is the pilot.

- `PlayGame` takes the SDK path when a module has `create`. Both paths feed one `finishedRun` state.
- "Play again" calls `instance.restart()`. In the Browser pane the same `Phaser.Game`, renderer and canvas were kept.
- Hiding the tab pauses the run behind a React "Paused" overlay.
- The dev global `window.__g4jGame` exposes the running game.
  Depends on: T4.3
  Goal: the platform creates games; games never touch `window`, `localStorage` or `gameEvents` directly.
  Files: `platform/host.ts`, `platform/mount.ts`, `platform/storage/bestScore.ts` (move from utils), `platform/audio/*`, `pages/games/PlayGame.tsx`
  Steps:

1. `createHost({ manifest, onGameOver, platformAdapters })`: wraps `bestScore`, audio kit, haptics (`navigator.vibrate` web; Capacitor later), analytics (`utils/analytics.ts`), `rng` (seeded, mulberry32), safe-area from CSS env vars.
2. `createGameMount(host, el, { scenes, physics? })`: builds the Phaser config from `manifest.design` (FIT, CENTER_BOTH, transparent, `parent: el`), injects `host` into the scene registry (`game.registry.set("host", host)`), returns a `GameInstance` whose `restart()` restarts the active scene (not a new `Phaser.Game`), `pause/resume` call `scene.pause/resume` and stop audio, `destroy()` calls `game.destroy(true)` and removes listeners.
3. `PlayGame.tsx`: replace the `load → mount → dispatchGameStart` sequence with `module.create(host, el)` then `instance.start()`. The host's `onGameOver` sets the React game-over state. "Play Again" calls `instance.restart()`. Remove the `window` event bus (`utils/gameEvents.ts`) once all games are migrated (Phase 5); until then, the host also dispatches the legacy event so unmigrated games keep working.
4. `visibilitychange` → `instance.pause()`; resume on user tap of a "Paused" overlay rendered by React.
   Done when: Reflex Ring (migrated as the pilot in this task) runs through host/mount, restarts without creating a new WebGL context (check `game.renderer` identity in a test or console), and game over reaches React; tests for `host.rng` determinism and `bestScore`.

## T4.5 BasePlatformScene and HUD kit

Status: done (2026-10-08).

- **Base scene.** `BasePlatformScene` handles `startRun()`, `endRun()` (one report after `endRunDelayMs`), `onCleanup`, and pause/resume hooks. The timing rule lives in the pure `runEnder.ts` and is tested.
- **HUD.** `hud/Hud.ts` provides score, best, hearts, timer, popup and countdown as sticker panels. The pure `hud/format.ts` is tested.
- **Snapadile** runs on the base scene with its hand-rolled HUD, overlay, restart and oscillator deleted. The full cycle was checked in the Browser pane.
  Depends on: T4.4
  Goal: a base scene every game extends, with the shared HUD and lifecycle.
  Files: `platform/scenes/BasePlatformScene.ts`, `platform/hud/*`
  Steps:

1. `BasePlatformScene extends Phaser.Scene`: `get host()`, `hud` (score, best, hearts(n), timer(ms), popup(text, x, y), countdown(3)), `endRun(score, stats?)` (freezes input, plays the end sting, calls `host.gameOver` after a configurable delay with the duration computed by the base), `onPause/onResume` hooks, standard `shutdown` cleanup (timers, tweens, listeners), `safeArea` offsets for HUD placement, `fonts` from the host.
2. HUD visuals in the sticker-book style: ink-outlined rounded panels, `BRAND_FONTS.display`, colours from `host.colors`.
3. Confirm modal and "Paused" are React overlays, not Phaser, so they look identical in every game.
   Done when: Snapadile migrated onto the base scene as the second pilot; its hand-rolled hearts, score text and game-over overlay are deleted; tests for `endRun` timing logic (pure part).

## T4.6 Input kit

Status: done (2026-10-08).

- **Kit.** `platform/input/`: `holdZones`, `tapZones` (Space and Enter work for a single zone), `swipe` and `keys`, plus the moved and restyled `dpad` and on-screen keyboard. The pure `gestures.ts` is tested. Every helper tears down on scene shutdown.
- **Games moved.** Cosmic Clash uses `holdZones`. Serpento steers by absolute direction with swipe plus a sticky d-pad, and can't reverse into itself. Blocker uses `zoneIndex`. All three were checked in the Browser pane.
- **Not done.** An 8-way d-pad: no game needs one yet.
  Depends on: T4.5
  Goal: all touch patterns in one place.
  Files: `platform/input/{tapZones,holdZones,swipe,dpad,keys}.ts` (move `game/ui/dpad.ts` and `onScreenKeyboard.ts` here)
  Steps:

1. `holdZones(scene, { left, right })` (Paddle Pop, Cosmic Clash, Car Crash pattern), `tapZones`, `swipe(scene, { threshold })` returning direction events, `dpad(scene, opts)` (existing, generalised: sticky/momentary, 4-way/8-way), `keys(scene, map)` mirroring keyboard to the same events for desktop.
2. Each helper returns `{ destroy() }` and is auto-destroyed by the base scene on shutdown.
   Done when: Cosmic Clash and Serpento use the kit (Serpento switches to swipe + d-pad); no game defines its own pointer-zone maths.

## T4.7 Audio kit

Status: done (2026-10-08).

- **Audio kit.** The single AudioContext is created only from the first tap or key press, so there are no autoplay warnings. It has synth beep, ding, thud and pop. Mute is global and saved in `g4j:muted`. Recorded SFX load from `public/assets/<id>/sfx/` for the manifest's `sfx` list, with a synth fallback.
- **Mute button.** It sits in the game header for SDK games only, and also mutes the running Phaser sound. Muting in Reflex Ring carried into Snapadile.
- **Reflex Ring** now has hit, perfect and end sounds.
- **Not done.** The legacy games' oscillator copies are removed as each game migrates in Phase 5.
  Depends on: T4.5
  Goal: one `AudioContext`, a mute toggle, synthesized defaults, and a loader for AI-generated SFX from Phase 8.
  Files: `platform/audio/{context,synth,sfx,mute}.ts`, `components/layout/Header.tsx` (mute button), settings
  Steps:

1. Lazy single `AudioContext` created on first user gesture. `synth.beep(freq, ms)`, `ding()`, `thud()`, `pop()`.
2. `sfx.load(manifestId, names[])` loads `public/assets/<id>/sfx/*.mp3` if present, falls back to synth.
3. Global mute persisted in `g4j:muted`; a speaker button in the game header; `host.audio.muted`.
4. Delete the ~15 oscillator copies as games migrate (Phase 5).
   Done when: mute works across two games; audio starts only after a tap (no autoplay warnings in the console).

## T4.8 Registry from manifests, sitemap and SEO from manifests

Status: done (2026-10-08).

- **Manifests.** Every game has a manifest. Scoring limits are the backend defaults, to be tuned in T6.6.
- **Registry.** `platform/registry.ts` globs manifests eagerly and code lazily. `games/index.ts` is a thin `GameMeta` view (`allGames` and `games`), with no array.
- **Inactive games.** A direct link shows a "taking a break" page.
- **SEO.** `GAME_SEO_META` and the fake ESRB `contentRating` are gone. `scripts/export-manifests.mts` (tsx, zod-validated) writes `public/game-meta.json`, and the sitemap and static pages use only `active` games from it.
  Depends on: T4.3
  Goal: adding a game = adding a folder.
  Files: `platform/registry.ts`, `games/index.ts` (becomes a thin re-export), `scripts/generate-sitemap.mjs`, `utils/seoKeywords.ts` (`GAME_SEO_META` moves into manifests), `hooks/useGameCatalog.ts`
  Steps:

1. `registry.ts`: `import.meta.glob("../games/*/manifest.ts", { eager: true })` → `games: GameManifest[]` sorted by `updatedAt`; `loadGame(id)` → `import(\`../games/${id}/index.ts\`)`.
2. `status` filtering: `active` shown to all; `beta` to beta testers; `inactive` hidden everywhere (but routes still resolve for direct links with an "This game is taking a break" page).
3. The sitemap script imports a generated `public/game-meta.json` produced by a `scripts/export-manifests.mjs` step run before build (tsx), so it never parses TS by regex.
4. `useGameCatalog` merges server config (title overrides, campaigns) over manifests.
   Done when: deleting `games/index.ts`'s array breaks nothing; the sitemap lists only `active` games; the manifest test from T4.3 runs in `npm test`.

## T4.9 Developer docs for the SDK

Status: done (2026-10-08).

- **Docs.** `src/platform/README.md` and `docs/plan/templates/new-game-checklist.md`.
- **Validation run.** A separate agent built `src/games/stack-tower/` (`beta`, by Harvey) from only those two documents. It has pure `useCases/overlap.ts` with 9 tests and a placeholder cover. Checks passed, and the full play cycle worked in the Browser pane.
- **Fixes from its 16 documentation findings.**
  - The HUD now uses `setScrollFactor(0)`.
  - `zoneIndex` and `sideOf` are exported from `platform/input`.
  - `tapZones` taps on Space and Enter.
  - The README gained: the asset path, colour conversion, `update`/`runEnded`, the restart object rules, mount options, HUD placement, audio fallbacks, a manifest field table, scoring guidance and per-game check commands.
    Depends on: T4.8
    Goal: Claude can add a game from the docs alone.
    Files: `apps/player-web/src/platform/README.md`, `apps/player-web/CLAUDE.md`, `docs/plan/templates/new-game-checklist.md`
    Steps:

1. README: the contract, a 60-line example game ("Stack Tower" skeleton from Phase 11 ideas), the host API, HUD/input/audio kits, how `endRun` and restart work, the manifest fields, how covers and SFX are discovered.
2. New-game checklist: folder, manifest, cover via Phase 8 pipeline, tests for use-cases, Browser pane smoke test, status `beta` first.
   Done when: a fresh session can create a trivial game following only the README (try it: Stack Tower skeleton as `beta`).
