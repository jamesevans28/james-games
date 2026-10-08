#!/usr/bin/env node
/**
 * T8.3: a game's final cover and link-preview card from one generated image.
 *   node scripts/art/cover.mjs <gameId> <hero.png> [--quantise]
 * Writes apps/player-web/public/assets/<gameId>/cover.png + cover.webp (1024×1024, with a
 * small "by …" maker sticker) and og.png (1200×630: art left, title and tagline right).
 * Text is drawn by this script in the brand fonts, never by the image model.
 */
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { display, body, textPath, textWidth } from "../lib/text.mjs";
import { PALETTE, PUBLIC, parseArgs, quantise } from "./lib.mjs";

const { flags, positional } = parseArgs(process.argv.slice(2));
const [gameId, hero] = positional;
if (!gameId || !hero) {
  console.error("Usage: cover.mjs <gameId> <hero.png> [--quantise]");
  process.exit(2);
}
const manifests = JSON.parse(readFileSync(path.join(PUBLIC, "game-meta.json"), "utf8"));
const game = manifests.find((m) => m.id === gameId);
if (!game) {
  console.error(
    `No manifest for ${gameId} in public/game-meta.json (run the manifest export first).`,
  );
  process.exit(1);
}
const outDir = path.join(PUBLIC, "assets", gameId);
mkdirSync(outDir, { recursive: true });

async function art(side) {
  const resized = await sharp(hero)
    .flatten({ background: PALETTE.paper })
    .resize(side, side, { fit: "contain", background: PALETTE.paper })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (flags.quantise) quantise(resized.data);
  return sharp(resized.data, { raw: resized.info }).png().toBuffer();
}

function makersLine(makers) {
  if (makers.length <= 1) return `by ${makers[0] ?? "Games4James"}`;
  return `by ${makers.slice(0, -1).join(", ")} & ${makers.at(-1)}`;
}

/** Shrinks the font until the text fits `max` px wide. */
function fit(text, size, max, font) {
  let s = size;
  while (s > 12 && textWidth(text, s, font) > max) s -= 2;
  return s;
}

// Cover: art full bleed, a white maker sticker in the bottom-right corner.
{
  const label = makersLine(game.makers);
  const size = fit(label, 40, 560, body);
  const w = Math.ceil(textWidth(label, size, body)) + 48;
  const h = size + 36;
  const x = 1024 - w - 36;
  const y = 1024 - h - 36;
  const sticker = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
    <g transform="rotate(-3 ${x + w / 2} ${y + h / 2})">
      <rect x="${x}" y="${y + 6}" width="${w}" height="${h}" rx="${h / 2}" fill="${PALETTE.ink}" opacity="0.25"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#fff" stroke="${PALETTE.ink}" stroke-width="5"/>
      ${textPath(label, x + 24, y + h / 2 + size * 0.36, size, PALETTE.ink, body)}
    </g></svg>`;
  const img = sharp(await art(1024)).composite([{ input: Buffer.from(sticker) }]);
  const buf = await img.png().toBuffer();
  await sharp(buf).png({ compressionLevel: 9 }).toFile(path.join(outDir, "cover.png"));
  await sharp(buf).webp({ quality: 86 }).toFile(path.join(outDir, "cover.webp"));
}

// OG card: 1200×630, art in a 630 square on the left, words on the right.
{
  const left = 630;
  const maxText = 1200 - left - 60;
  const titleSize = fit(game.title, 96, maxText, display);
  const tagline = game.tagline ?? "";
  const words = tagline.split(" ");
  const lines = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last && textWidth(`${last} ${word}`, 36, body) <= maxText)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  const text = [
    textPath(game.title, left + 10, 230, titleSize, PALETTE.ink, display),
    ...lines.slice(0, 3).map((l, i) => textPath(l, left + 10, 300 + i * 48, 36, PALETTE.ink, body)),
    textPath(
      makersLine(game.makers),
      left + 10,
      300 + Math.min(lines.length, 3) * 48 + 24,
      30,
      PALETTE.tomato,
      body,
    ),
    textPath("games4james.com", left + 10, 580, 30, PALETTE.ink, display),
  ].join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">${text}</svg>`;
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: PALETTE.paper } })
    .composite([{ input: await art(630), left: 0, top: 0 }, { input: Buffer.from(svg) }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, "og.png"));
}
console.log(`assets/${gameId}/cover.png, cover.webp, og.png`);
