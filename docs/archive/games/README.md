# Archived game code

The prototype code of the five inactive games (T5.1), moved here in T5.13 so the legacy window event bus could be deleted. Their manifests stay in `apps/player-web/src/games/<id>/manifest.ts` (status `inactive`) so direct links show the "taking a break" page.

This code is **not compiled, linted or tested**. It used the pre-SDK `mount(container)` contract and `utils/gameEvents.ts`, which no longer exist. To bring a game back (T11.9), rebuild it on the Game SDK following `docs/plan/templates/new-game-checklist.md` and `docs/plan/backlog-inactive-games.md`, using this code only as a reference. Their art is still in `apps/player-web/public/assets/<id>/`.
