#!/usr/bin/env node
/**
 * T8.3: give a cut-out a white sticker border and a soft shadow (avatars, achievement stickers).
 *   node scripts/art/sticker.mjs <in.png> <out-base> [--size 256] [--border 12] [--no-shadow]
 */
import sharp from "sharp";
import { parseArgs } from "./lib.mjs";

const { flags, positional } = parseArgs(process.argv.slice(2));
const [input, outBase] = positional;
if (!input || !outBase) {
  console.error("Usage: sticker.mjs <in.png> <out-base> [--size 256] [--border 12] [--no-shadow]");
  process.exit(2);
}
const size = Number(flags.size ?? 256);
const border = Number(flags.border ?? 12);
const pad = border + 8;
const inner = size - 2 * pad;

const art = await sharp(input)
  .ensureAlpha()
  .trim({ threshold: 10 })
  .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const placedArt = await sharp(art)
  .extend({
    top: pad,
    bottom: pad,
    left: pad,
    right: pad,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

// Border: dilate the alpha by blurring it and thresholding (in JS, so channel counts stay explicit).
const one = { raw: { width: size, height: size, channels: 1 } };
const { data: rgba } = await sharp(placedArt)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const artAlpha = Buffer.alloc(size * size);
for (let i = 0; i < artAlpha.length; i++) artAlpha[i] = rgba[i * 4 + 3];
async function blurMask(mask, sigma) {
  const { data, info } = await sharp(mask, one)
    .blur(sigma)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(size * size);
  for (let i = 0; i < out.length; i++) out[i] = data[i * info.channels];
  return out;
}
const spread = await blurMask(artAlpha, border / 2);
const alpha = Buffer.from(spread.map((v) => (v > 8 ? 255 : 0)));
const solid = (hex, mask) =>
  sharp({ create: { width: size, height: size, channels: 3, background: hex } })
    .joinChannel(mask, one)
    .png()
    .toBuffer();
const white = await solid("#ffffff", alpha);

const layers = [];
if (!flags["no-shadow"]) {
  const soft = await blurMask(alpha, 4);
  const shadow = await solid("#2B2118", Buffer.from(soft.map((v) => Math.round(v * 0.35))));
  layers.push({ input: shadow, left: 0, top: 3 });
}
layers.push({ input: white, left: 0, top: 0 }, { input: placedArt, left: 0, top: 0 });
const img = sharp({
  create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite(layers);
const buf = await img.png().toBuffer();
await sharp(buf).png({ compressionLevel: 9 }).toFile(`${outBase}.png`);
await sharp(buf).webp({ quality: 88 }).toFile(`${outBase}.webp`);
console.log(`${outBase}.png/.webp ${size}×${size}`);
