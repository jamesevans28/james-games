#!/usr/bin/env node
// T10.2: source images for the native app icons and splash screens, from the brand
// mark. Then `npx @capacitor/assets generate --ios --android` (in apps/player-web) writes every
// iOS/Android size. Rerun both after the Phase 8 logo (T8.7) lands.
//   node scripts/generate-app-assets.mjs
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const brand = JSON.parse(
  readFileSync(path.join(root, "apps/player-web/src/config/brand.json"), "utf8"),
);
const mark = readFileSync(path.join(root, "apps/player-web/public/brand/logo-mark.svg"));
const out = path.join(root, "apps/player-web/assets");
mkdirSync(out, { recursive: true });

const PAPER = brand.backgroundColor;
const DARK = "#1F1A15";

async function markAt(size) {
  return sharp(mark, { density: 1200 }).resize(size, size).png().toBuffer();
}

async function square(file, size, background, markSize) {
  const offset = Math.round((size - markSize) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: await markAt(markSize), left: offset, top: offset }])
    .png()
    .toFile(path.join(out, file));
}

// iOS icon: full square, no transparency. Android adaptive: foreground in the 66% safe zone.
await square("icon-only.png", 1024, PAPER, 760);
await square("icon-foreground.png", 1024, { r: 0, g: 0, b: 0, alpha: 0 }, 600);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: PAPER } })
  .png()
  .toFile(path.join(out, "icon-background.png"));
// Splash: the mark small in the middle of a big square (cropped to each screen).
await square("splash.png", 2732, PAPER, 520);
await square("splash-dark.png", 2732, DARK, 520);
console.log(
  "Wrote apps/player-web/assets/{icon-only,icon-foreground,icon-background,splash,splash-dark}.png",
);
