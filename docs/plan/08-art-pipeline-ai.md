# Phase 8: AI-generated "kids art" pipeline

Decision: all art is AI-generated, in a consistent style that reads as drawn by kids. Claude Code cannot generate images itself; this phase sets up a style bible, prompt templates, scripts for post-processing, and a repeatable workflow. Images are generated either by James in an image tool (ChatGPT image generation, Midjourney, Ideogram, Leonardo) using the prompts, or by a script that calls an image API (see T8.2 for the zero-cost vs paid choice).

## T8.1 Style bible

Status: done in code 2026-10-09 (STYLE.md + prompts); MANUAL: James generates one test image per category into docs/art/samples/
Depends on: T3.1
Goal: one document that makes every generated asset look like it belongs to the same crayon box.
Files: `docs/art/STYLE.md`, `docs/art/prompts/*.md`
Steps:

1. Write `STYLE.md`:
   - **Look:** "crayon and marker drawings by a kid, scanned and cleaned up": thick wobbly black outlines, flat fills with slight crayon texture, deliberately simple shapes, big friendly eyes on characters, white or paper background, no gradients, no shading, no text in images.
   - **Palette:** the brand tokens (paper `#FFF8EC`, ink `#2B2118`, tomato `#FF5A4E`, sun `#FFC93C`, grass `#3DBE6B`, sky `#3FA9F5`, grape `#8E6CEF`) plus two extras for skin/wood (`#F2B58A`, `#B5783F`).
   - **Characters:** each game has one hero object (croc, snake, kart, rocket, ring, block). Consistent proportions: head ≈ 40% of height for creatures.
   - **Asset types and sizes:** cover 1024×1024 (hero centred, 15% margin, paper background); sprite 512×512 transparent PNG per frame on a fixed grid; icon 512×512; avatar 256×256; sticker 256×256 with a white 12 px border and drop shadow added by script, not by the model.
   - **Negative prompt / avoid:** realistic, 3D render, gradient, text, watermark, signature, photo, blurry, neon.
2. Base prompt template (every asset prompt starts with it):
   ```
   A simple drawing of {subject}, as if drawn by a 7-year-old with thick black marker outlines and flat crayon colours, cheerful, on a plain cream paper background, centred, full body, no text, no shadows, no gradients. Colours limited to coral red, sunflower yellow, grass green, sky blue, grape purple, black outline.
   ```
3. Per-asset prompt files in `docs/art/prompts/`: `covers.md` (one block per active game with the subject and composition), `sprites.md` (croc idle/bite, snake head/body/tail, kart, rocket, alien ×3, hoop ring, block pieces ×7, paddle, ball, fireball, bubble), `avatars.md` (16 animals), `stickers.md` (20 achievement stickers), `logo.md` (GAMES 4 JAMES lettering in rainbow crayon letters with a drawn game controller).
   Done when: the files exist; James generates one test image per category and they look like one set when placed side by side (commit the test set to `docs/art/samples/`).

## T8.2 Generation workflow (two options, pick one)

Status: done 2026-10-09 (generate.mjs: --dry-run prints prompts; OpenAI Images with IMAGE_API_KEY; decision recorded)
Depends on: T8.1
Option A (zero cost, manual): James pastes prompts into ChatGPT/Ideogram/Midjourney, downloads PNGs into `art-inbox/<category>/<name>.png` (gitignored). Claude runs the processing scripts (T8.3).
Option B (scripted, small cost): `scripts/art/generate.mjs` calls an image API (OpenAI Images, Replicate Flux, Ideogram API) with the prompt files, writing to `art-inbox/`. Needs an API key in `.env.local` (`IMAGE_API_KEY`); typical cost a few cents per image. Only run when James asks; never in CI.
Steps: implement B's script with a `--dry-run` that prints the prompts, so A and B share the same prompt source. Record the choice in `DECISIONS.md`.
Done when: `node scripts/art/generate.mjs --dry-run covers` prints 11 prompts.

## T8.3 Processing scripts

Status: done 2026-10-09 (remove-bg, process, sheet, cover, sticker, check; tested on a synthetic sample)
Depends on: T8.1
Goal: raw generations become consistent game assets with one command.
Files: `scripts/art/{process,remove-bg,sheet,cover,sticker}.mjs`, root devDeps `sharp`, `@imgly/background-removal-node` (or `rembg` via a documented Python fallback)
Steps:

1. `remove-bg`: alpha-matte the subject (needed for sprites; covers keep the paper background). Verify alpha is real (reject images whose "transparent" area is a checkerboard pattern: sample a 4×4 grid of pixels in the corners).
2. `process`: trim, pad to the target size, quantise to the palette (nearest colour, keeps outlines black), export PNG and WebP.
3. `sheet`: pack frames named `<sprite>-<frame>.png` into `<sprite>.png` + `<sprite>.json` (Phaser atlas JSON hash format).
4. `cover`: compose the final 1024×1024 cover from the hero image + paper background + the "made by" sticker (text rendered by script with Baloo 2, not by the model) and the 1200×630 OG crop. Write to `apps/player-web/public/assets/<gameId>/cover.png|webp` and `og.png`.
5. `sticker`: white border + soft shadow for avatars and achievement stickers.
6. `scripts/art/check.mjs`: every active manifest's cover exists at 1024×1024 and OG at 1200×630; fails the build otherwise (wired in Phase 9).
   Done when: running the chain on the T8.1 samples produces valid files; `check.mjs` passes.

## T8.4 Covers for the 11 active games

Status: todo
Depends on: T8.2, T8.3, T4.8
Steps: generate, process, commit covers and OG images; update each manifest's `cover`; delete the old `thumbnail.svg`/`*.jpg` covers (move the four painted ones to `docs/archive/art/`). Update the 15 static SEO pages' `og:image` via regeneration (T3.4 script).
Done when: the home grid shows 11 covers in one style; `check.mjs` passes; link previews show the new OG images.

## T8.5 Sprites for the keepers

Status: todo
Depends on: T8.3, each game's Phase 5 task
Order: Snapadile (croc ×2 frames, raft, splash), Serpento (head, body, tail, apple), Cosmic Clash (rocket, aliens ×3, bolt), Hoop City (ring, ball, cloud), Paddle Pop (paddle, ball, fireball, disc), Blocker (7 piece styles or one tile style), Box Cutter (cutter, spark enemy), Reflex Ring (arrow, ring, 4 power-ups).
Steps per game: generate → `remove-bg` → `process` → `sheet` → load in the scene via the SDK asset convention (`public/assets/<id>/sprites/`) → replace the generated-texture code → smoke test.
Done when: the game's scene has no `fillRect`/`fillCircle` drawing of the hero objects; frame sizes documented in the manifest `assets` field.

## T8.6 Avatars and stickers

Status: todo
Depends on: T8.3, T7.5
Steps: 16 animal avatars (256²) and the first 20 achievement stickers (first play, first best, 5 games tried, 3 days this week, beat 100 in X, etc.) generated and processed; `src/config/avatars.ts` and `src/config/stickers.ts` list them with ids and alt text; the temporary SVG avatars from T3.2 are removed.
Done when: avatar picker shows the 16; profile shows earned stickers.

## T8.7 Logo and brand assets final

Status: todo
Depends on: T8.1, T3.2
Steps: generate the crayon "GAMES 4 JAMES" logo variants per `logo.md`; vectorise the chosen one (potrace via `scripts/art/vectorise.mjs` or Inkscape trace) to `logo.svg` and `logo-mark.svg`; re-run `generate-brand-icons.mjs`; replace the T3.2 placeholders.
Done when: icons, OG and header all use the final logo; PWA audit still passes.

## T8.8 Sound effects (AI-generated)

Status: todo
Depends on: T4.7
Steps: generate a small SFX set (tap, pop, ding, thud, whoosh, fanfare, 3-2-1 beeps) with an AI sound tool (ElevenLabs sound effects has a free tier; alternatives: Stable Audio, or synth presets from `jsfxr` exported as WAV). Convert to short MP3 + OGG with `ffmpeg` (`scripts/art/sfx.mjs`), place in `public/assets/shared/sfx/`, and map in `platform/audio/sfx.ts`. Keep each under 50 KB.
Done when: every active game plays the shared set through the audio kit; total SFX size under 600 KB.

## T8.9 Art README for future sessions

Status: done 2026-10-09 (docs/art/README.md)
Depends on: T8.3
Files: `docs/art/README.md`
Steps: how to add art for a new game in 6 steps (prompt → generate → inbox → process → manifest → check), with the exact commands.
Done when: a session can produce a cover for the Stack Tower skeleton (T4.9) using only this README.
