# Phase 5: Games — inactive flag and keeper polish

Decisions: cut games go `inactive` (kept in the repo, hidden from the catalog, re-activatable). Keepers are migrated onto the SDK and polished one per session. Every migrated game ends up with: manifest, `BasePlatformScene`, input/audio kits, no direct `window`/`localStorage`, pure rules in `useCases/` with tests, correct `controls` text, a `scoring.max` that reflects real play.

Order: T5.1 first, then one keeper per session in the listed order. Fix-ups (T5.9–T5.12) after the six keepers.

## T5.1 Set the cut games to `inactive`

Status: done (2026-10-09). The five manifests (written in T4.8) are now `status: "inactive"`. A per-game `retireNote` was not added: the T4.8 break page has one friendly message for all of them. The grid shows 11 games, the sitemap has 25 URLs and 11 static pages, and `/games/car-crash` shows the break page. Rework notes are in `backlog-inactive-games.md`.
Depends on: T4.8
Goal: Car Crash, Block Breaker, Ready Steady Shoot, Fill the Cup and Ho Ho Home Delivery are hidden but intact.
Files: those five `games/<id>/manifest.ts`, `platform/registry.ts`, `pages/games/PlayGame.tsx`, `pages/games-list/index.tsx`, `scripts/generate-sitemap.mjs`
Steps:

1. Create a minimal manifest for each with `status: "inactive"` and a `retireNote` ("Taking a break while we rework it").
2. Direct links show a friendly "taking a break" page with a link home; they are excluded from sitemap, feed, grid and leaderboard lists.
3. (Full reset: there are no scores to keep.)
4. Add a `docs/plan/backlog-inactive-games.md` with the review's rework notes per game (Car Crash → swipe-lane runner; Block Breaker → bricks mode inside Paddle Pop; Ready Steady Shoot → Hoop City free-throw bonus with fixed power curve; Fill the Cup + Ho Ho → one "conveyor timing" template with skins).
   Done when: the grid shows 11 games; `/games/car-crash` renders the break page; `npm test` passes.

## T5.2 Reflex Ring (pilot, finished)

Status: done (2026-10-09).

- **SDK.** On `BasePlatformScene` with the kit HUD, `tapZones` and kit audio, and `endRun` (shake and flash, no in-scene overlay). The DOM letterbox listener is gone.
- **Rules and art.** `useCases/rules.ts` (`segmentHit`, `isPerfect`, `nextVelocity`, `pickTarget`, `powerupRoll`, all on `host.rng`) with 6 tests. Power-ups use the four SVGs, and wedges use the brand crayons with ink outlines. The instruction text is ink on paper; the grey background blocks were dropped.
- **Scoring** is calculated rather than measured (no live data after the reset): ceiling about 14 points/s, so `max` 5,000 and `perSecondMax` 15.
- **Smoke test:** three runs with two Play-agains in the same game, best updating, no console errors.
  Depends on: T4.4 (it was the mount pilot), T4.5
  Goal: fully on the SDK, polished.
  Files: `games/reflex-ring/**`
  Steps:

1. Finish the migration: scene extends `BasePlatformScene`; HUD from the kit; audio from the kit; `endRun` replaces the in-scene overlay; delete the DOM letterbox listener (the host's tap zone covers the stage).
2. Use the four `powerup-*.svg` assets (currently drawn as circles).
3. Extract pure rules to `useCases/`: `segmentHit(angle, segment, tolerance)`, `nextSpeed(speed, hits)`, `powerupRoll(rng)`. Tests.
4. Fix instruction text colour (readable on paper background).
5. Manifest `scoring`: measure a very good run; set `max` ≈ 3× that, `perSecondMax` from the fastest possible tap rate.
   Done when: 0 ESLint game-rule disables in the folder; tests pass; smoke test in the Browser pane: play, die, Play Again twice, mute works.

## T5.3 Snapadile

Status: done (2026-10-09).

- **Rules.** `useCases/rules.ts` has `spawnSchedule(elapsedMs)`, `scoreFor`, `loseLife`, `MAX_LIVES` and `pickSpawn` on `host.rng`, with 6 tests. Difficulty is now a deterministic function of play time; the old random concurrency bump is gone. One self-rescheduling spawn timer replaces the two `callbackScope` timers, so the lint disable is gone.
- **Countdown.** A 3-2-1 countdown starts each run. While building it I fixed `Hud.countdown`, which resolved instantly during scene create; it now cancels on shutdown.
- **Bug found.** Spawn points were duplicated on every restart; fixed.
- **Not done.** The sprite swap waits for Phase 8.
- **Smoke test:** countdown, then crocs, game over, and Play again with a fresh countdown in the same game.
  Depends on: T5.2
  Steps: same migration recipe. Extract `spawnSchedule(elapsedMs)`, `lives`, `scoreFor(hit)` to use-cases with tests. Stop ripple timers on shutdown. Replace the generated rectangle croc/raft with the Phase 8 AI sprites when available (manifest `cover` and `assets` fields point at the new files; until then keep the current ones). Add a 3-2-1 countdown from the HUD kit.
  Done when: as T5.2.

## T5.4 Blocker

Status: todo
Depends on: T5.3
Steps: migration recipe. Fix slot pick (hit-test the piece sprites, not screen quadrants) so the rotate button doesn't start a drag. Three-slot tray. Placement points (+1 per cell). Extract `fits(board, piece, pos)`, `clearLines(board)`, `powerCellFor(linesCleared)` with tests (board logic is ideal for tests).
Done when: as T5.2.

## T5.5 Box Cutter

Status: todo
Depends on: T5.4
Steps: migration recipe (already closest). Remove dead use-cases if T1.9 didn't. Handle resize properly or switch to FIT 540×960 like the others (prefer FIT). Level advance on an explicit "Next level" tap, not any pointer down. Dispatch game over on death, not after a tap. Add lives (3) and one power-up (slow enemies for 5 s). Tests already possible for `captureFill`, `grid`, `score`.
Done when: as T5.2.

## T5.6 Hoop City

Status: todo
Depends on: T5.5
Steps: migration recipe. Gravity only after first tap. Make the skyline either collidable or remove it from the objective text. Restart via host. Extract `passQuality(ballY, ringY, ringGap)` and `comboNext(combo, quality)` with tests. Add a "Free throw" bonus every 10 hoops using the fixed power curve from the Ready Steady Shoot backlog note (optional stretch).
Done when: as T5.2.

## T5.7 Cosmic Clash

Status: todo
Depends on: T5.6
Steps: migration recipe. Bullets via `group.get()` with pooling (no orphans). Replace `forEach`-while-removing with reverse loops or `getChildren().slice()`. Remove unused physics config. Fix controls text ("hold left or right"). Extract `waveFor(level)`, `powerupUnlocks(level)` with tests. Restart via host.
Done when: as T5.2.

## T5.8 Paddle Pop

Status: todo
Depends on: T5.7
Steps: migration recipe. Fireball timers and colliders tracked and removed on fireball death. Bonus ring tween via scene tweens, not `requestAnimationFrame`. Difficulty ramp on elapsed time, not `time % 10000 < 100`. Disc hit cooldown per disc. Fix controls text. Extract `speedFor(elapsed)`, `splitBalls(balls)` with tests. Stretch: a "Bricks" mode toggle on the landing page that seeds a brick wall (absorbs Block Breaker; see backlog).
Done when: as T5.2.

## T5.9 Word Stack

Status: todo
Depends on: T5.8
Steps: migration recipe. Remove duplicated current-word render. Fix `async` functions that never await. Add a daily seeded starting word via `host.rng(dateSeed)` (shares the daily-challenge mechanism from Phase 11; the seed helper lives in the SDK). Keep the keyboard and dictionary in `platform/input` and `game/words`. Tests for `isValidStep(a, b)`, `scrabbleScore(word)`.
Done when: as T5.2.

## T5.10 Serpento

Status: todo
Depends on: T5.9
Steps: migration recipe. Controls: swipe (primary) + d-pad (visible toggle) replacing relative left/right. Draw the snake head sprite that is loaded but unused. Extract `step(state, dir)`, `eat`, `collides` with tests.
Done when: as T5.2.

## T5.11 Flash Bash

Status: todo
Depends on: T5.10
Steps: migration recipe. Score only correct presses; fix the +1-before-check bug. Keep the shape→colour mapping fixed within a round (reshuffle only between rounds and tell the player). Remove the `position: fixed; z-index: 9999` container hijack (the mount owns the container). Buttons laid out by the scene for 540×960 FIT (no RESIZE). Colour-blind safe: shapes differ as well as colours (they do; keep it that way). Tests for `sequence(rng, length)`, `judge(input, expected)`.
Done when: as T5.2.

## T5.12 Word Rush (kid re-theme)

Status: todo
Depends on: T5.11
Steps: migration recipe. Rename to "Word Rush" (Tom removed in T3.3). Replace `data/*` categories with kid-safe ones (animals, food, colours, school things, places, sports, kids' films, nature, jobs, things in a house); delete actors, brands, quotes, drinks, counties, sportsPlayers. Single `AudioContext` via the kit. One confirm modal from the HUD kit. Guard double submit (`gameActive=false` immediately on correct answer). Clamp timer display at 0:00. Add gentle difficulty: levels 1–3 shorter phrases, 4+ longer. Tests for `revealLetters(phrase, chosen)`, `timeFor(level)`.
Done when: as T5.2.

## T5.13 Retire the legacy event bus

Status: todo
Depends on: T5.12
Goal: no game uses `utils/gameEvents.ts`; the host is the only channel.
Steps: delete `utils/gameEvents.ts` and the legacy dispatch in the host; remove the ESLint disables added in T4.1; `GameLanding.tsx` listens to the catalog/query invalidation instead of a window event.
Also (deferred from T2.2): enable `"noUncheckedIndexedAccess": true` in apps/player-web/tsconfig.json and fix the remaining errors (102 at T2.2 time, 93 of them in game code that Phase 5 rewrites).
Done when: player-web typechecks with noUncheckedIndexedAccess on; `git grep gameEvents apps` is empty; all 11 active games pass the smoke test; `npm run lint` is clean with no file-level disables in `src/games`.
