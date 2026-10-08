# Games4James art style

Every picture in Games4James should look like it came out of the same crayon box: drawn by a kid, scanned, and tidied up a little. This file is the rule book. The prompts in [prompts/](prompts/) and the scripts in `scripts/art/` follow it; [README.md](README.md) says how to make a new asset.

## The look

- **Crayon and marker drawings by a 7-year-old.** Thick, wobbly black outlines; flat fills with a slight crayon texture; simple shapes; big friendly eyes on anything alive.
- **Plain cream paper background.** No scenery unless the prompt asks for it, no gradients, no shading, no drop shadows (the scripts add the shadows they need).
- **No text in images, ever.** Titles, "made by" lines and numbers are added by `scripts/art/cover.mjs` in the brand font, so they're always spelled right.
- **Cheerful, never scary.** Monsters are silly. Teeth are blunt. Nothing realistic.

## Palette

The brand crayons, plus two extras for skin and wood. `scripts/art/process.mjs` snaps every pixel to the nearest of these, which is what makes images from different days match.

| Name   | Hex       | Use                         |
| ------ | --------- | --------------------------- |
| paper  | `#FFF8EC` | background                  |
| ink    | `#2B2118` | outlines, eyes              |
| tomato | `#FF5A4E` | red things, danger, hearts  |
| sun    | `#FFC93C` | yellow things, stars, coins |
| grass  | `#3DBE6B` | green things, crocs, snakes |
| sky    | `#3FA9F5` | water, sky, blue things     |
| grape  | `#8E6CEF` | purple things, magic, space |
| skin   | `#F2B58A` | skin, sand                  |
| wood   | `#B5783F` | wood, baskets, rafts        |
| white  | `#FFFFFF` | eye whites, highlights      |

## Characters

Each game has one hero object (the croc, the snake, the rocket, the ring, the block…). Creatures have a head about 40% of their height, two dot eyes with a white highlight, and a small smile. Keep a hero the same between the cover and the sprites: generate the cover first, then ask for sprites "in the same style as this image" with the cover attached.

## Asset types

| Type    | Size                                | Background                       | Made by                                         |
| ------- | ----------------------------------- | -------------------------------- | ----------------------------------------------- |
| Cover   | 1024×1024, hero centred, 15% margin | paper                            | `cover.mjs` (adds title sticker, writes OG too) |
| OG card | 1200×630                            | paper                            | `cover.mjs`                                     |
| Sprite  | 512×512 per frame, same grid        | transparent                      | `remove-bg.mjs` → `process.mjs` → `sheet.mjs`   |
| Icon    | 512×512                             | transparent                      | `remove-bg.mjs` → `process.mjs`                 |
| Avatar  | 256×256                             | transparent, white border        | `remove-bg.mjs` → `process.mjs` → `sticker.mjs` |
| Sticker | 256×256                             | transparent, white border+shadow | `remove-bg.mjs` → `process.mjs` → `sticker.mjs` |

## Base prompt

Every prompt starts with this; `{subject}` comes from the prompt files.

```
A simple drawing of {subject}, as if drawn by a 7-year-old with thick black marker outlines and flat crayon colours, cheerful, on a plain cream paper background, centred, full body, no text, no shadows, no gradients. Colours limited to coral red, sunflower yellow, grass green, sky blue, grape purple, black outline.
```

**Avoid** (add as the negative prompt where the tool supports one): realistic, 3D render, gradient, text, letters, watermark, signature, photo, blurry, neon, glow, shading, background scenery.
