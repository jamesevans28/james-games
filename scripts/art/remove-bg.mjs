#!/usr/bin/env node
/**
 * T8.3: cut a drawing out of its paper background.
 *   node scripts/art/remove-bg.mjs <in.png> <out.png> [--tolerance 48]
 * Flood-fills from the edges through paper-coloured pixels (the ink outline stops it),
 * then feathers the edge by one pixel. Refuses images with a painted checkerboard.
 */
import sharp from "sharp";
import { floodRemoveBackground, looksLikeCheckerboard, parseArgs } from "./lib.mjs";

const { flags, positional } = parseArgs(process.argv.slice(2));
const [input, output] = positional;
if (!input || !output) {
  console.error("Usage: remove-bg.mjs <in.png> <out.png> [--tolerance 48]");
  process.exit(2);
}
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (looksLikeCheckerboard(data, info.width, info.height)) {
  console.error(
    `${input}: the background is a painted checkerboard, not transparency. Regenerate on plain paper.`,
  );
  process.exit(1);
}
const cleared = floodRemoveBackground(data, info.width, info.height, Number(flags.tolerance ?? 48));
// Soften the cut by one pixel: blur the alpha channel slightly and recombine.
// (Separate raw passes: sharp applies removeAlpha after joinChannel in one pipeline.)
const raw = { width: info.width, height: info.height };
const alpha = await sharp(data, { raw: info }).extractChannel(3).blur(0.6).raw().toBuffer();
const rgb = await sharp(data, { raw: info }).removeAlpha().raw().toBuffer();
await sharp(rgb, { raw: { ...raw, channels: 3 } })
  .joinChannel(alpha, { raw: { ...raw, channels: 1 } })
  .png()
  .toFile(output);
console.log(
  `${output}: cleared ${Math.round((cleared / (info.width * info.height)) * 100)}% background`,
);
