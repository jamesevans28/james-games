# Making art for Games4James

All art is AI-generated in one kid-drawn style ([STYLE.md](STYLE.md)). Claude can't draw. A person, or the paid API script, makes the raw images; the scripts in `scripts/art/` turn them into game assets that match. Raw images go in `art-inbox/`, which is gitignored.

## A cover for a game, in six steps

1. **Prompt.** Add a `### <gameId>` block to [prompts/covers.md](prompts/covers.md) with a `Subject:` line, and optionally `Composition:`.
2. **Generate.** Print the prompt:
   ```bash
   node scripts/art/generate.mjs --dry-run covers --only <gameId>
   ```
   Paste it into ChatGPT, Ideogram or Midjourney (square, 1024 px) and save the result as `art-inbox/covers/<gameId>.png`.
   Or, with an `IMAGE_API_KEY` (an OpenAI key, a few cents an image) in `apps/backend-api/.env.local`:
   ```bash
   node scripts/art/generate.mjs covers --only <gameId>
   ```
3. **Pick.** Make 3–4 and keep the one that looks most like the other covers placed side by side. No text in the picture.
4. **Process.** This writes `public/assets/<gameId>/cover.png`, `cover.webp` and `og.png`, adding the "by …" sticker and the title in the brand font:
   ```bash
   node scripts/art/cover.mjs <gameId> art-inbox/covers/<gameId>.png --quantise
   ```
   Drop `--quantise` if snapping to the crayon palette makes it blotchy.
5. **Manifest.** Set `cover: "/assets/<gameId>/cover.png"` in the game's `manifest.ts`, then re-export the manifests:
   ```bash
   npx tsx scripts/export-manifests.mts
   ```
6. **Check.**
   ```bash
   node scripts/art/check.mjs
   ```
   This must pass; CI runs it.

## Sprites

1. Generate each frame on paper, named `<sprite>-<frame>.png`, in `art-inbox/sprites/<gameId>/`. Attach the game's cover and say "in the same style as the attached image".
2. Cut out each frame and size it:
   ```bash
   node scripts/art/remove-bg.mjs in.png cut.png
   node scripts/art/process.mjs cut.png out/<sprite>-<frame> --size 512
   ```
   If the cut-out leaks into the subject, the outline has a gap: raise or lower `--tolerance`, or fix the gap with a paint tool.
3. Pack the frames:
   ```bash
   node scripts/art/sheet.mjs out apps/player-web/public/assets/<gameId>/sprites/<sprite>
   ```
   This writes a Phaser atlas (`.png` and `.json`). Load it in the scene with `this.load.atlas(...)`.

## Avatars and stickers

Run `remove-bg.mjs`, then `process.mjs --size 256`, then:

```bash
node scripts/art/sticker.mjs in.png out-base
```

That adds the white border and shadow. Avatars go to `public/brand/avatars/`; stickers go to `public/brand/stickers/`.

## Rules

- No text from the model, except the logo. Everything else is drawn by `cover.mjs` in Baloo 2 / Nunito.
- Never commit `art-inbox/`. Commit only processed files under `apps/player-web/public/`.
- Keep files small: covers under 300 KB as WebP, sprites under 100 KB per sheet where possible.
