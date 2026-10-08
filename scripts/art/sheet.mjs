#!/usr/bin/env node
/**
 * T8.3: pack frames into a Phaser atlas.
 *   node scripts/art/sheet.mjs <frames-dir> <out-base>
 * Packs every <name>.png in <frames-dir> into <out-base>.png + <out-base>.json (JSON hash).
 * Frame keys are the file names without .png (e.g. croc-idle, croc-bite).
 */
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { atlasJson, packFrames, parseArgs } from "./lib.mjs";

const { positional } = parseArgs(process.argv.slice(2));
const [dir, outBase] = positional;
if (!dir || !outBase) {
  console.error("Usage: sheet.mjs <frames-dir> <out-base>");
  process.exit(2);
}
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".png"))
  .sort();
const frames = [];
for (const f of files) {
  const meta = await sharp(path.join(dir, f)).metadata();
  frames.push({
    name: f.replace(/\.png$/, ""),
    file: path.join(dir, f),
    w: meta.width,
    h: meta.height,
  });
}
const { placed, width, height } = packFrames(frames);
await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(placed.map((p) => ({ input: p.file, left: p.x, top: p.y })))
  .png({ compressionLevel: 9 })
  .toFile(`${outBase}.png`);
writeFileSync(
  `${outBase}.json`,
  `${JSON.stringify(atlasJson(placed, path.basename(`${outBase}.png`), width, height), null, 2)}\n`,
);
console.log(`${outBase}.png ${width}×${height}, ${placed.length} frames`);
