# James Games — Copilot Instructions

These are project-specific guidelines for AI-assisted coding in this repo.

## Repo Overview

This is a monorepo containing:

- `apps/player-web/`: Player-facing React + Vite PWA. Mobile-first UI.
- `apps/player-web/src/games/`: Each game lives in `apps/player-web/src/games/<gameId>/` and is mounted dynamically.
- `apps/backend-api/`: Express API deployed to AWS Lambda.
- `apps/admin-web/`: Admin React + Vite app used for operational tooling.

Key integration points:

- **Game ↔ App events**: `apps/player-web/src/utils/gameEvents.ts`
- **Player-web API client**: `apps/player-web/src/lib/api.ts`
- **Admin-web API client**: `apps/admin-web/src/lib/api.ts`
- **Game registry + metadata**: `apps/player-web/src/games/index.ts`

## Core Principles

1. **Mobile-first**: portrait layout, touch-first input, stable 60 FPS.
2. **Keep games isolated, share logic intentionally**: game-specific rendering stays in the game folder; reusable logic moves to shared utilities.
3. **Prefer pure logic**: write game rules as testable, side-effect-free functions where possible.
4. **Avoid global state**: no cross-game globals; communicate via events and the existing API helpers.

## Frontend (React) Rules

- Use React function components and hooks.
- Use Tailwind via existing tokens and patterns; do not invent new themes.
- Keep routing/UI in `apps/player-web/src/` and game logic in `apps/player-web/src/games/`.
- Auth is cookie-based via backend; keep calls using `credentials: "include"`.

## Game Architecture (Phaser)

Games are Phaser-based but mounted from React.

### Expected Game Shape

- Each game exports `mount(container: HTMLElement)` which returns an object with `destroy()`.
- Use `pointerdown`/touch-friendly input (avoid `click`).
- Use `Phaser.Scale.FIT` and `CENTER_BOTH` for consistent portrait scaling.

### Clean Architecture Layers (per game)

When adding new games (or refactoring existing ones), prefer this folder layout **inside** `apps/player-web/src/games/<gameId>/`:

- `entities/`: Plain domain objects with no Phaser dependencies.
- `useCases/`: Pure functions that implement rules (movement, scoring, win/lose, collisions as math).
- `adapters/`: Phaser-specific bridge code (sprites, sounds, particles, input mapping).
- `scenes/`: `Phaser.Scene` classes and orchestration.

This is a guideline, not a hard requirement for legacy games. New games should follow it.

## Shared / Reusable Game Logic (Important)

This project will accumulate many games. To keep velocity high:

### What belongs in shared code

Prefer shared modules for:

- **Math + geometry**: vectors, easing helpers, collision math, interpolation.
- **Timers / state machines**: deterministic gameplay loops, cooldowns, wave logic.
- **Scoring + difficulty curves**: reusable curves, combo rules, pacing utilities.
- **Input helpers**: drag/aim/hold semantics as framework-agnostic helpers (Phaser wiring stays in adapters/scenes).
- **Audio synth helpers**: Web Audio utilities used by multiple games.
- **Common UI helpers**: score formatting, best-score persistence helpers.

### Where shared code should live

- **Game-only shared utilities (preferred)**: `apps/player-web/src/game/`
  - Use this for cross-game logic that is part of gameplay (difficulty, spawners, cooldowns, scoring rules, input semantics, math helpers).
  - Keep it Phaser-agnostic when possible.
- **App/React utilities (integration + UI)**: `apps/player-web/src/utils/`
  - Use this for app-layer helpers like analytics, share links, caches, and `gameEvents`.

Avoid copying the same logic across multiple game folders. If you copy/paste something twice, that’s the moment to extract it.

### Extraction triggers (rule of thumb)

- **Second implementation wins**: if you implement the same mechanic twice (even slightly differently), extract a shared helper.
- **Parameterizable differences**: if the only differences are numbers/timings/curves, make those inputs/config.
- **Bug fixed twice**: if you fix the same class of bug in 2 games, extract the fix into a shared utility to harden it once.

### Shared module conventions

- Put game-only building blocks in `apps/player-web/src/game/` with names like:
  - `game/difficulty.ts` (difficulty curves)
  - `game/cooldowns.ts` (cooldown timers)
  - `game/spawn.ts` (spawn schedules)
  - `game/rng.ts` (seeded/random helpers)
  - `game/math/*` (geometry/interpolation)
- Put app/integration helpers in `apps/player-web/src/utils/` (e.g., analytics, `gameEvents`).
- Shared modules should expose **small functions** and **plain data types**; avoid exporting Phaser types.

### Hardening rule

When extracting shared logic:

- Make it **Phaser-agnostic** when possible (pure TS/JS).
- Keep APIs small and stable.
- Add clear docs/comments _only when it improves reuse_ (no noisy commentary).

### Do / Don’t (avoid duplicated systems)

**Do**

- Extract reusable mechanics once they appear in 2+ games (spawners, difficulty curves, cooldown timers, combo rules).
- Keep shared modules pure and deterministic where possible (input → output; no Phaser types).
- Design shared utilities as small building blocks (e.g., `nextDifficulty(state, score, elapsedMs)`), not one giant “engine”.
- Put Phaser wiring in the game’s `adapters/` or `scenes/`, and call shared/pure logic from there.
- Write shared code to be “future-game friendly”: explicit inputs, minimal hidden assumptions, and stable return shapes.

**Don’t**

- Copy/paste a spawner/timer/state-machine across game folders; extract it.
- Let shared utilities import from a specific game folder.
- Couple shared logic to Phaser runtime objects (sprites, scenes, tweens). Pass plain data instead.
- Over-generalize prematurely. Only abstract what’s proven common.
- Add new “frameworks” or global singletons for cross-game state.

## Key Patterns & Conventions

### Phaser config pattern

Use the established portrait config pattern (see existing games like `apps/player-web/src/games/reflex-ring/index.ts`):

```ts
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 540,
  height: 960,
  parent: container,
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 540,
    height: 960,
  },
  scene: [MainScene],
};
```

### Assets

- Store assets under `apps/player-web/public/assets/<gameId>/`.
- Prefer lightweight SVG thumbnails (no text).

### Analytics

- Use `apps/player-web/src/utils/analytics.ts`.
- Fire a game-start event on mount (follow existing patterns).

### Scores / XP

- Post high scores via `apps/player-web/src/lib/api.ts`.
- XP is score × `xpMultiplier` from `apps/player-web/src/games/index.ts`.
- Local best score should use `localStorage` with a game-scoped key.

## Development Workflow

- Dev (player): `npm run web:dev`
- Build (player): `npm run web:build`
- Build (admin): `npm run admin:build`
- Build (backend): `npm run backend:build`

Testing is currently mostly manual playtesting. When writing new logic that is Phaser-agnostic (entities/useCases/shared utilities), prefer pure functions so unit tests can be added later with minimal refactor.

## Creating a New Game Checklist

1. Create `apps/player-web/src/games/<gameId>/` with `index.ts` exporting `mount()`.
2. Add assets under `apps/player-web/public/assets/<gameId>/` and a `thumbnail.svg`.
3. Register the game in `apps/player-web/src/games/index.ts` with a lazy `load()`.
4. If you change gameplay logic for an existing game, update the `updatedAt` field in `apps/player-web/src/games/index.ts`.
5. Prefer touch input (`pointerdown`) and keep frame-time stable.

## Performance Guidelines (Phaser)

- Keep `update(time, delta)` lean; move conditional logic into state machines/use cases.
- Use pooling for frequently created/destroyed objects (particles, bullets, enemies).
- Cache references; don’t repeatedly look up the same objects each frame.
- Minimize draw calls (sprite sheets/atlases when appropriate).

## Naming & Style

- Classes: `PascalCase`
- Functions/vars: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Prefer clarity over cleverness.

## Copilot Prompting Tips

Good prompts reference the architecture:

- “Create a Phaser-agnostic use case for scoring and difficulty curves.”
- “Extract this duplicated spawn logic into a shared utility under `apps/player-web/src/utils/`.”
- “Implement a small FSM helper (pure TS) suitable for multiple games.”
