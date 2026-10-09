# The Game SDK

Everything a game needs from the platform, and the contract a game implements. Read this before adding or migrating a game. The checklist for a new game is in `docs/plan/templates/new-game-checklist.md`.

**Working example:** `src/games/stack-tower/` is a complete, small SDK game. It has a manifest, a scene on the base scene, pure use-cases with tests, and a placeholder cover. It was built from this README alone as the T4.9 check. Copy its shape.

## The contract in one minute

A game is a folder `apps/player-web/src/games/<id>/` with:

| File          | What it exports                                                                          | Loaded                                  |
| ------------- | ---------------------------------------------------------------------------------------- | --------------------------------------- |
| `manifest.ts` | `export default defineGame({...})`: metadata only, **no Phaser import**                  | eagerly, for lists, SEO and the sitemap |
| `index.ts`    | `export const create: CreateGame` and `export { default as manifest } from "./manifest"` | lazily, when someone presses Play       |
| `scenes/`     | Phaser scenes extending `BasePlatformScene`                                              | with `index.ts`                         |
| `useCases/`   | pure game logic (no Phaser), with `*.test.ts` next to it                                 | with `index.ts`                         |

**Assets live outside the game folder**, in `apps/player-web/public/assets/<id>/`. They are served at `/assets/<id>/...`: the cover, art, and optional `sfx/<name>.mp3`. A scene loads them in its `preload()`.

The registry (`registry.ts`) finds the folder by its manifest. There is nothing to register by hand.

Games talk to the platform only through the **host** they are given. They never use `window` events, `localStorage` or `window.location`, and lint enforces this for `src/games/**`.

## Skeleton

```ts
// manifest.ts (see the field reference below)
import { defineGame } from "../../platform/sdk";
export default defineGame({ id: "stack-tower", title: "Stack Tower", status: "beta" /* ... */ });

// index.ts
import type { CreateGame } from "../../platform/sdk";
import { createGameMount } from "../../platform/mount";
import StackScene from "./scenes/StackScene";
export { default as manifest } from "./manifest";
export const create: CreateGame = (host, el) => createGameMount(host, el, { scenes: [StackScene] });

// scenes/StackScene.ts
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { tapZones } from "../../../platform/input";
import { hexToNumber } from "../../../platform/hud/format";
import { dropBlock, type Span } from "../useCases/overlap";

export default class StackScene extends BasePlatformScene {
  private score = 0;
  private moving: Span = { x: 0, w: 300 };
  private gfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super("StackScene"); // don't touch this.host or this.hud here: they don't exist yet
  }

  // Runs on the first start and after every "Play again". Reset fields AND create
  // all game objects here: a restart destroys the previous display list.
  protected startRun() {
    this.score = 0;
    this.moving = { x: 0, w: 300 };
    this.gfx = this.add.graphics();
    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());
    tapZones(this, { count: 1, onTap: () => this.drop() }); // Space/Enter work too
  }

  update(_time: number, delta: number) {
    if (this.runEnded) return; // update keeps running after endRun(); only input stops
    // move things by speed * delta / 1000, redraw...
  }

  private drop() {
    const { kept } = dropBlock(this.moving /* , below */);
    if (!kept) return this.endRun(this.score); // plays the end sting + fail haptic, then the score dialog
    this.score += 1;
    this.hud.setScore(this.score);
    this.hud.popup("+1", this.scale.width / 2, 400);
    this.host.audio.play("hit");
  }
}
```

## The host (`sdk.ts` → `GameHost`)

| Member                                           | Use it for                                                                                                                                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest`                                       | your own manifest (ids, design size)                                                                                                                                                                                    |
| `gameOver({ score, stats? })`                    | end the run. Prefer `this.endRun(score)` in a `BasePlatformScene`. Only the first call per run counts. The platform measures the duration (paused time excluded) and saves the best score.                              |
| `best.get()`                                     | this device's best, for the HUD                                                                                                                                                                                         |
| `audio.beep/ding/thud/pop()`, `audio.play(name)` | sounds. All respect the global mute and stay silent until the player's first tap.                                                                                                                                       |
| `haptics.tap/success/fail()`                     | short vibrations where supported                                                                                                                                                                                        |
| `rng(seed?)`                                     | deterministic random numbers (mulberry32). Use it for anything a daily challenge might replay.                                                                                                                          |
| `safeArea()`                                     | notch/home-bar insets in CSS px                                                                                                                                                                                         |
| `analytics.event(name, params)`                  | a GA event tagged with the game id. No PII.                                                                                                                                                                             |
| `fonts`                                          | `display`, `body`, `note` font stacks for Phaser text                                                                                                                                                                   |
| `colors`                                         | `paper`, `ink`, `tomato`, `sun`, `grass`, `sky`, `grape` as **CSS hex strings** (`"#FF5A4E"`). Use them as-is for text colours. For Graphics fills and strokes convert with `hexToNumber()` from `platform/hud/format`. |
| `isPaused()`                                     | true while the platform has the run paused                                                                                                                                                                              |
| `reducedMotion()`                                | true when the player asked for less motion; skip shakes, flashes and big zooms (`BasePlatformScene.shakeCamera`/`flashCamera` already do)                                                                               |
| `remix.get(key)`                                 | remix mode (T11.2): this run's knob value, from the remix being played or the manifest default. Read it in `startRun()`, e.g. `host.remix.get("gravity")`; defaults must be the normal game.                            |

In a scene, `this.host` (BasePlatformScene) or `getHost(this)` (from `mount.ts`) returns it. The host lives in the game registry, so it isn't available in the constructor or in field initialisers.

## Lifecycle

```
Play  → module.create(host, el) → instance.start() → Phaser boots → scene.create() → startRun()
Run over → this.endRun(score) → input off, "end" sound, fail haptic → (endRunDelayMs, 900 ms) → host.gameOver()
       → React shows the score dialog and posts the score
Play again → instance.restart() → scene shutdown + create() (same Phaser.Game, same WebGL context) → startRun()
Tab hidden → instance.pause() (scenes + sound; update() stops) → React "Paused" overlay → tap → instance.resume()
Leave → instance.destroy()
```

Rules that follow from this:

- **Reset per-run fields and create every game object in `startRun()`.** The scene object survives restarts and class field initialisers only run once, but the display list is rebuilt each time.
- **Shutdown happens on every Play again.** Timers, tweens and input-kit handlers are cleared then, so nothing stacks up. Anything else you add, such as DOM listeners, goes in `this.onCleanup(fn)`.
- **Don't build your own game-over screen, restart button, pause screen or score/best text.** The platform owns them. `endRun()` already plays the end sound and the fail haptic, so don't add your own.
- **Per-frame work:** override `update(time, delta)` and start it with `if (this.runEnded) return;`. Move things with `delta` (ms), never per-frame constants.
- `onPause()` / `onResume()` are optional hooks.

`createGameMount(host, el, options)` options:

- `scenes`: required; the first one starts.
- `physics`: Phaser physics config, e.g. `{ default: "arcade" }`.
- `backgroundColor`: the canvas is **transparent by default**, so the page's paper colour shows through.

## Kits

**HUD** (`this.hud`): sticker-style panels, created on first use, at depth 1000, fixed to the screen even if you scroll the camera.

- `setScore(n)`: top-left.
- `setBest(n)`: under the score.
- `setHearts(current, max)`: top-right.
- `setTimer(ms)`: top-centre.
- `popup(text, x, y, color?)` and `await countdown(3)`.

Keep gameplay out of the top ~140 design px, where these sit.

**Input** (`platform/input`). Every helper removes itself when the scene shuts down.

| Helper                                                              | Pattern                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `tapZones(scene, { count, onTap(zone), keyboard? })`                | tap anywhere (`count: 1`; Space and Enter also tap) or one of N vertical strips |
| `holdZones(scene, { onChange(-1/0/1), onTap?, tapMs?, keyboard? })` | hold the left/right half to move, quick tap to nudge; arrows and A/D on desktop |
| `swipe(scene, { onSwipe(dir), threshold?, maxMs?, keyboard? })`     | swipe up/down/left/right; arrows and WASD on desktop                            |
| `dpad(scene, { ..., mode: "hold" \| "sticky" })`                    | on-screen 4-way pad                                                             |
| `keys(scene, { ArrowUp: fn, " ": fn, ... })`                        | extra desktop keys; names are `KeyboardEvent.key` values (Space is `" "`)       |
| `createOnScreenKeyboard(...)`                                       | letter keyboard for word games                                                  |

Pure gesture maths (`classifySwipe`, `zoneIndex`, `sideOf`, `OPPOSITE`) is exported from `platform/input` too.

**Audio:** list recorded effects in the manifest (`sfx: ["drop", "crash"]`) and put them at `public/assets/<id>/sfx/<name>.mp3`. `host.audio.play("drop")` uses the file once it has loaded, otherwise a synth fallback. The names `hit`, `score`, `miss`, `end` and `tap` have their own synth sounds; any other name falls back to `pop`.

## Manifest fields

The types are in `sdk.ts` (`GameManifest`), and validation is the zod schema in `manifestSchema.ts`. `platform/manifest.test.ts` checks every game on `npm test`: the schema, folder = id, unique ids, the cover file exists, and listed sfx files exist.

| Field                                  | Rules                                                                                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                   | lowercase-with-dashes, equal to the folder name; it is the URL `/games/<id>`                                                                                                                         |
| `title`                                | ≤ 40 characters                                                                                                                                                                                      |
| `tagline`                              | ≤ 80 characters, one line for tiles and previews                                                                                                                                                     |
| `description`, `objective`, `controls` | shown on the game page ("About" / "How to play")                                                                                                                                                     |
| `seo.description`                      | 20–160 characters, for search and link previews, in the family voice. "Free, no ads." is true; claim nothing else.                                                                                   |
| `seo.category`                         | `reflex`, `puzzle`, `word`, `arcade`, `sports`, `memory`, `action`, `casual` or `strategy`                                                                                                           |
| `makers`, `note`, `noteBy`             | credits and the kid's designer's note, shown on the game page                                                                                                                                        |
| `status`                               | `beta` (beta testers only) → `active` (everyone) → `inactive` (hidden; a direct link shows "taking a break")                                                                                         |
| `input`                                | any of `tap`, `hold`, `swipe`, `drag`, `dpad`, `keyboard`                                                                                                                                            |
| `scoring`                              | server-side anti-cheat limits and XP rate (the backend uses them from T6.6, and too-low values reject real scores). `perSecondMax` ≈ 2× the fastest real scoring rate; `max` well above a great run. |
| `cover`                                | a square png, jpg, webp or svg under `/assets/`. An SVG placeholder until the Phase 8 art; link previews then use the brand card.                                                                    |
| `sfx`                                  | optional effect names (`[a-z0-9-]`)                                                                                                                                                                  |
| `remix`                                | optional knobs `{ key, label, min, max, step, default }` (T11.2): one landing-page slider each; the server checks saved remixes against the exported ranges.                                         |
| `design`, `orientation`                | `{ w: 540, h: 960 }`, `"portrait"`                                                                                                                                                                   |

After changing manifests, `npm run generate-seo -w apps/player-web` re-exports `public/game-meta.json` (via `scripts/export-manifests.mts`) and regenerates the sitemap and static preview pages. The production build does this automatically.

## Checks for one game

Use Node 24 (`.nvmrc`). From the repo root:

```bash
npx eslint apps/player-web/src/games/<id>
npx prettier --check apps/player-web/src/games/<id>
npx vitest run --project player-web
npx vitest run --project player-web --coverage --coverage.include="**/<id>/useCases/**"
npm run typecheck -w apps/player-web
```

The 80% use-case coverage is a target per game. CI enforces coverage per folder from Phase 9, and game use-cases join the threshold as Phase 5 migrates each game.

## Testing in the Browser pane

- The Play page exposes the running game as `window.__g4jGame` in dev.
- When the pane is hidden, Phaser's frame loop doesn't tick. Drive it with `const l = __g4jGame.loop; l.raf.stop(); l.raf.start(l.step.bind(l), true, 16)`.
- Beta games aren't listed for normal players, but `/games/<id>` always opens them.
