# New game checklist

Work through this in order. The SDK reference is `apps/player-web/src/platform/README.md`, and `src/games/stack-tower/` is a working example. Use Node 24.

1. **Folder.** Create `apps/player-web/src/games/<id>/`. The id is lowercase-with-dashes and is also the URL (`/games/<id>`).
2. **Manifest.** Add `manifest.ts` with `defineGame({...})`:
   - `status: "beta"`.
   - Real `makers` (who actually made it).
   - `createdAt` and `updatedAt` set to today.
   - A `seo.description` in the family voice, 20–160 characters.
3. **Entry.** Add `index.ts` exporting `create` (via `createGameMount`) and re-exporting `manifest`.
4. **Scene.** Add `scenes/<Name>Scene.ts`, extending `BasePlatformScene` and implementing `startRun()`:
   - Reset every per-run field at its top.
   - End the run with `this.endRun(score)`.
   - Use `this.hud` for score, best, hearts and timer. Don't hand-roll them.
   - Use the input kit (`platform/input`) for touch. Don't write your own pointer-zone maths.
   - Use `this.host.audio` for sound and `this.host.rng()` for randomness that should be repeatable.
5. **Logic.** Put the rules in `useCases/` as pure functions, each with a `*.test.ts`. Use-cases need 80% line coverage (`npm run test:coverage`).
6. **Cover and art.** Make the cover and art with the Phase 8 pipeline (`docs/plan/08-art-pipeline-ai.md`) and put them in `apps/player-web/public/assets/<id>/`. Until that exists, use a placeholder cover `cover.svg` with these properties:
   - square `viewBox="0 0 512 512"`;
   - paper background `#FFF8EC`;
   - shapes in the crayon colours (`#FF5A4E`, `#FFC93C`, `#3DBE6B`, `#3FA9F5`, `#8E6CEF`) with thick ink outlines (`#2B2118`, 10–12 px).
7. **Sounds (optional).** Put files at `public/assets/<id>/sfx/<name>.mp3` and list them in the manifest `sfx`.
8. **Checks.** These must all pass (the per-game versions are in the README, under "Checks for one game"): `npm run lint`, `npm run typecheck`, `npm test` (the manifest test covers the new game automatically) and `npm run format:check`.
9. **Browser pane.** At 375×812, as a beta tester:
   - Play a full run.
   - Check that game over shows the score dialog.
   - Check that Play again restarts cleanly: score 0, the same canvas.
   - Check that hiding the tab pauses the game.
   - Check that mute works.
10. **SEO files.** Run `npm run generate-seo -w apps/player-web`. Beta games stay out of the sitemap, so this only refreshes `game-meta.json`.
11. **Commit** with the task id.
12. **Go active.** After the family has played it for a week, flip `status` to `"active"` in a separate commit.
