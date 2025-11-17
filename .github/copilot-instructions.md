# James Games - AI Coding Guidelines

## Project Overview

Mobile-first web game hub built with React + Vite and Phaser 3. Each game is self-contained in `/src/games/[gameId]/` with dynamic mounting. React handles routing, UI, and cross-game state; Phaser manages game logic and rendering. Games communicate via custom events (`src/utils/gameEvents.ts`).

## Architecture

- **Frontend**: React functional components with hooks, Tailwind CSS for styling, no class components.
- **Games**: Phaser 3 scenes extended from `Phaser.Scene`. Each game exports a `mount(container)` function creating a `Phaser.Game` instance.
- **Integration**: Games dispatch events (e.g., `dispatchGameOver`) for React to show dialogs. No global state management yet (Redux planned but unused).
- **Backend**: Minimal API via `src/lib/api.ts` for score posting; uses `fetch` with JSON.

## Key Patterns

- **Phaser Config** (see `src/games/reflex-ring/index.ts`):
  ```typescript
  const config = {
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
    scene: [ReflexRingGame],
  };
  ```
- **Mounting Games**: Phaser.Game with parent container, destroy via game.destroy(true).
- **Input**: Use `pointerdown` for touch/mobile (not `click`).
- **Analytics**: gtag-based (`src/utils/analytics.ts`), events like `game_start` fired on mount.
- **Assets**: Static in `/public/assets/[gameId]/`, loaded relatively.
- **Sounds**: Synthesized Web Audio API (oscillators/gains), no audio files.

## Development Workflow

- **Dev**: `npm run dev` (Vite with custom config).
- **Build**: `npm run build` (produces PWA-ready bundle).
- **Game Creation**: Copy existing game folder, update `src/games/index.ts` with lazy import.
- **Testing**: Manual playtesting; no automated tests yet.

## Conventions

- ES modules (`import/export`), async/await.
- PascalCase components, camelCase vars.
- Touch-optimized: Portrait mode, 60 FPS target, lazy-load games.
- Error Handling: Try/catch in mounts, non-blocking API calls.
- Code Style: Modular Phaser scenes, commented gameplay logic.

## Examples

- Game Structure: `src/games/reflex-ring/` (ReflexRingGame.ts scene, index.ts mount).
- Event Flow: Game over → `dispatchGameOver` → React shows ScoreDialog over paused game.
- UI: ScoreDialog overlays with `z-[10000]`, blocks interactions until closed.

## Creating a New Game

1. **Copy an existing game**: Duplicate `/src/games/reflex-ring/` to `/src/games/[newId]/`, rename files/classes (e.g., `ReflexRingGame.ts` → `NewGame.ts`).
2. **Update Phaser scene**: Modify `create()`, `update()` for gameplay. Use `Phaser.Scene` extension, `pointerdown` for input, tweens/animations for effects.
3. **Implement mount**: In `index.ts`, export `mount(container)` creating `Phaser.Game` with FIT scale (see reflex-ring example).
4. **Add thumbnail**: Create `thumbnail.svg` in `/public/assets/[newId]/` for game listings.
5. **Register game**: Add entry to `src/games/index.ts` with lazy import (e.g., `load: async () => import("./[newId]/index")`).
6. **Utilize shared systems**:
   - **Score tracking**: Use localStorage for high scores (`localStorage.getItem/setItem` with `${GAME_ID}-best`).
   - **Game over**: Call `dispatchGameOver({ gameId: GAME_ID, score })` to trigger ScoreDialog.
   - **Analytics**: Call `trackGameStart(gameId, title)` on mount.
   - **Backend**: Use `postHighScore` from `src/lib/api.ts` for score submission.
   - **Sounds**: Synthesize via Web Audio API (oscillators/gains) for effects like pop/ding.
   - **Particles**: Use Phaser particles for backgrounds/effects.
7. **Incorporate shared components**: Games integrate with React via events; ScoreDialog handles post-game UI automatically.
8. **Patterns to follow**: Touch-optimized, 60 FPS, portrait mode, modular scenes, commented logic. Test on mobile, ensure no global state.

Prioritize mobile performance, simplicity, and Phaser best practices. Reference existing games for new ones.

When making changes to game logic, update the updatedAt field in the corresponding game entry in `src/games/index.ts`.
