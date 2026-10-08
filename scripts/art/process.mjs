#!/usr/bin/env node
/**
 * T8.3: trim, pad to a square target size, snap colours to the palette, write PNG + WebP.
 *   node scripts/art/process.mjs <in.png> <out-base> [--size 512] [--margin 0.06] [--no-quantise]
 * <out-base> has no extension: writes <out-base>.png and <out-base>.webp.
 */
import sharp from "sharp";
import { parseArgs, quantise } from "./lib.mjs";

const { flags, positional } = parseArgs(process.argv.slice(2));
const [input, outBase] = positional;
if (!input || !outBase) {
  console.error(
    "Usage: process.mjs <in.png> <out-base> [--size 512] [--margin 0.06] [--no-quantise]",
  );
  process.exit(2);
}
const size = Number(flags.size ?? 512);
const inner = Math.round(size * (1 - 2 * Number(flags.margin ?? 0.06)));

const trimmed = await sharp(input).ensureAlpha().trim({ threshold: 10 }).toBuffer();
const fitted = await sharp(trimmed)
  .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({
    top: Math.floor((size - inner) / 2),
    bottom: Math.ceil((size - inner) / 2),
    left: Math.floor((size - inner) / 2),
    right: Math.ceil((size - inner) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .raw()
  .toBuffer({ resolveWithObject: true });

if (!flags["no-quantise"]) quantise(fitted.data);
const img = sharp(fitted.data, { raw: fitted.info });
await img.clone().png({ compressionLevel: 9 }).toFile(`${outBase}.png`);
await img.clone().webp({ quality: 88, alphaQuality: 90 }).toFile(`${outBase}.webp`);
console.log(`${outBase}.png/.webp ${size}×${size}`);
