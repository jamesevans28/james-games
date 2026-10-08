# The Game SDK

Everything a game needs from the platform, and the contract a game implements. Read this before adding or migrating a game. The checklist for a new game is in `docs/plan/templates/new-game-checklist.md`.

## The contract in one minute

A game is a folder `src/games/<id>/` with:

| File                  | What it exports                                                                          | Loaded                                  |
| --------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------- |
| `manifest.ts`         | `export default defineGame({...})`: metadata only, **no Phaser import**                  | eagerly, for lists, SEO and the sitemap |
| `index.ts`            | `export const create: CreateGame` and `export { default as manifest } from "./manifest"` | lazily, when someone presses Play       |
| `scenes/`             | Phaser scenes extending `BasePlatformScene`                                              | with `index.ts`                         |
| `useCases/`           | pure game logic (no Phaser), with `*.test.ts` next to it                                 | with `index.ts`                         |
| `public/assets/<id>/` | art, the cover, and optional `sfx/*.mp3`                                                 | by the scene's `preload()`              |

The registry (`registry.ts`) finds the folder by its manifest. There is nothing to register by hand.

Games talk to the platform only through the **host** they are given. They never use `window` events, `localStorage`, `window.location` or `utils/gameEvents`, and lint enforces this for `src/games/**`.

## A complete game (Stack Tower skeleton)

`src/games/stack-tower/manifest.ts`:

```ts
import { defineGame } from "../../platform/sdk";

export default defineGame({
  id: "stack-tower", // = folder name
  title: "Stack Tower",
  tagline: "Drop each block on the tower. How high can you go?",
  description: "Blocks slide back and forth. Tap to drop each one on the tower.",
  objective: "Build the tallest tower you can.",
  controls: "Tap anywhere to drop the block.",
  makers: ["Harvey"],
  status: "beta", // new games start as beta (beta testers only)
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  scoring: { max: 10_000, perSecondMax: 5, xpMultiplier: 1 },
  cover: "/assets/stack-tower/cover.svg",
  createdAt: "2026-10-08T00:00:00.000Z",
  updatedAt: "2026-10-08T00:00:00.000Z",
  seo: {
    description: "Drop each block on the tower and see how high you can stack. Free, no ads.",
    category: "casual",
  },
});
```

`src/games/stack-tower/index.ts`:

```ts
import type { CreateGame } from "../../platform/sdk";
import { createGameMount } from "../../platform/mount";
import StackScene from "./scenes/StackScene";

export { default as manifest } from "./manifest";

export const create: CreateGame = (host, el) => createGameMount(host, el, { scenes: [StackScene] });
```

`src/games/stack-tower/scenes/StackScene.ts`:

```ts
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { tapZones } from "../../../platform/input";
import { overlap } from "../useCases/overlap";

export default class StackScene extends BasePlatformScene {
  private score = 0;

  constructor() {
    super("StackScene");
  }

  // Runs on the first start and again on every "Play again". Reset per-run fields here.
  protected startRun() {
    this.score = 0;
    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());
    tapZones(this, { count: 1, onTap: () => this.drop() }); // removed automatically on shutdown
  }

  private drop() {
    const kept = overlap(/* ... */);
    if (kept <= 0) return this.endRun(this.score); // the platform shows the score dialog
    this.score += 1;
    this.hud.setScore(this.score);
    this.hud.popup("+1", 270, 400);
    this.host.audio.play("drop"); // recorded sfx if listed in the manifest, else a synth sound
  }
}
```

## The host (`sdk.ts` → `GameHost`)

| Member                                           | Use it for                                                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `manifest`                                       | your own manifest (ids, design size)                                                                                                                                                       |
| `gameOver({ score, stats? })`                    | end the run. Prefer `this.endRun(score)` in a `BasePlatformScene`. Only the first call per run counts. The platform measures the duration (paused time excluded) and saves the best score. |
| `best.get()`                                     | this device's best for the HUD                                                                                                                                                             |
| `audio.beep/ding/thud/pop()`, `audio.play(name)` | sounds; all respect the global mute and stay silent until the player's first tap                                                                                                           |
| `haptics.tap/success/fail()`                     | short vibrations where supported                                                                                                                                                           |
| `rng(seed?)`                                     | deterministic random numbers (mulberry32). Use it for anything a daily challenge might replay.                                                                                             |
| `safeArea()`                                     | notch/home-bar insets in CSS px                                                                                                                                                            |
| `analytics.event(name, params)`                  | a GA event tagged with the game id. No PII.                                                                                                                                                |
| `fonts`, `colors`                                | `BRAND_FONTS` and `BRAND_COLORS` for canvas text and shapes                                                                                                                                |
| `isPaused()`                                     | true while the platform has the run paused                                                                                                                                                 |

In a scene, `this.host` (BasePlatformScene) or `getHost(this)` (from `mount.ts`) returns it.

## Lifecycle

```
Play  → module.create(host, el) → instance.start() → Phaser boots → scene.create() → startRun()
Run over → this.endRun(score) → input off, end sting → (endRunDelayMs, 900 ms) → host.gameOver()
       → React shows the score dialog and posts the score
Play again → instance.restart() → scene restarts (same Phaser.Game, same WebGL context) → startRun()
Tab hidden → instance.pause() (scenes + sound) → React "Paused" overlay → tap → instance.resume()
Leave → instance.destroy()
```

Rules that follow from this:

- **Reset per-run state at the top of `startRun()`.** The scene object survives restarts, and class field initialisers only run once.
- **Don't build your own game-over screen, restart button, pause screen or score/best text.** The platform owns them.
- **Timers, tweens and input-kit handlers are cleared on shutdown.** Anything else you add, such as DOM listeners, goes in `this.onCleanup(fn)`.
- `onPause()` / `onResume()` are optional hooks.

## Kits

**HUD** (`this.hud`, sticker-style, created on first use): `setScore(n)`, `setBest(n)`, `setHearts(current, max)`, `setTimer(ms)`, `popup(text, x, y, color?)`, `await countdown(3)`.

**Input** (`platform/input`; every helper removes itself on scene shutdown):

| Helper                                                              | Pattern                                                                     |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `tapZones(scene, { count, onTap(zone) })`                           | tap anywhere, or one of N vertical strips                                   |
| `holdZones(scene, { onChange(-1/0/1), onTap?, tapMs?, keyboard? })` | hold left/right half to move, quick tap to nudge; arrows and A/D on desktop |
| `swipe(scene, { onSwipe(dir), threshold?, maxMs?, keyboard? })`     | swipe up/down/left/right; arrows and WASD on desktop                        |
| `dpad(scene, { ..., mode: "hold" \| "sticky" })`                    | on-screen 4-way pad                                                         |
| `keys(scene, { ArrowUp: fn, ... })`                                 | extra desktop keys                                                          |
| `createOnScreenKeyboard(...)`                                       | letter keyboard for word games                                              |

Pure gesture maths (`classifySwipe`, `zoneIndex`, `OPPOSITE`) is in `input/gestures.ts` if a game needs it directly.

**Audio**: list recorded effects in the manifest (`sfx: ["drop", "crash"]`) and put them at `public/assets/<id>/sfx/<name>.mp3`. `host.audio.play("drop")` uses the file once it has loaded, otherwise a synth fallback. The names `hit`, `score`, `miss`, `end` and `tap` have sensible synth defaults.

## Manifest fields

The types are in `sdk.ts` (`GameManifest`), and validation is the zod schema in `manifestSchema.ts`. `platform/manifest.test.ts` checks every game on `npm test`: the schema, folder = id, unique ids, the cover file exists, and listed sfx files exist.

- `status`: `beta` (beta testers only) → `active` (everyone) → `inactive` (hidden; a direct link shows "taking a break").
- `scoring`: server-side sanity limits and XP rate. The backend reads these from the exported manifests (T6.6); the client never sends them.
- `cover`: a square image under `/assets/`. SVG is allowed until the Phase 8 covers; link previews then fall back to the brand card.
- `seo.description`: 20–160 characters, in the family voice ("Free, no ads." is true; don't claim anything else). `seo.category` feeds the JSON-LD genre.
- `makers`, `note`, `noteBy`: credits and the kid's designer's note, shown on the game page.

After changing manifests, `npm run generate-seo -w apps/player-web` re-exports `public/game-meta.json` (via `scripts/export-manifests.mts`) and regenerates the sitemap and static preview pages. The production build does this automatically.

## Testing

- Pure logic goes in `useCases/` with Vitest tests next to it (`import { test, expect } from "vitest"`). Use `host.rng(seed)` in logic you want to test deterministically.
- **Browser pane:** the Play page exposes the running game as `window.__g4jGame` in dev. When the pane is hidden, Phaser's frame loop doesn't tick; drive it with `const l = __g4jGame.loop; l.raf.stop(); l.raf.start(l.step.bind(l), true, 16)`.
