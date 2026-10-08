#!/usr/bin/env node
// T3.2: render the Games4James brand set from source art, in one command:
//   node scripts/generate-brand-icons.mjs
//
// Inputs:  apps/player-web/public/brand/logo-mark.svg (hand-written placeholder until
//          the Phase 8 AI art), apps/player-web/src/config/brand.json, and the
//          Baloo 2 / Nunito fonts from @fontsource (text is converted to paths so
//          the output never depends on fonts installed on this machine).
// Outputs: logo.svg (wordmark), icon-32/180/192/512.png, icon-512-maskable.png,
//          og-1200x630.png, all in apps/player-web/public/brand/.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const outDir = path.join(root, "apps/player-web/public/brand");
const brand = JSON.parse(readFileSync(path.join(root, "apps/player-web/src/config/brand.json"), "utf8"));

const C = {
  paper: "#FFF8EC",
  paper2: "#FDECD2",
  ink: "#2B2118",
  tomato: "#FF5A4E",
  sun: "#FFC93C",
  grass: "#3DBE6B",
  sky: "#3FA9F5",
  grape: "#8E6CEF",
};
const CRAYONS = [C.tomato, C.sun, C.grass, C.sky, C.grape];

function loadFont(file) {
  const buf = readFileSync(require.resolve(file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}
const display = loadFont("@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff");
const body = loadFont("@fontsource/nunito/files/nunito-latin-800-normal.woff");

// opentype.js's shaper chokes on these fonts' ccmp lookups, so lay glyphs out by
// hand (char → glyph, plus kerning). Latin text only, which is all we draw.
function layout(text, font, size) {
  const scale = size / font.unitsPerEm;
  const glyphs = Array.from(text).map((ch) => font.charToGlyph(ch));
  let x = 0;
  return glyphs.map((glyph, i) => {
    const at = x;
    const next = glyphs[i + 1];
    const kern = next ? Number(font.getKerningValue(glyph, next)) : 0;
    x += (glyph.advanceWidth + (Number.isFinite(kern) ? kern : 0)) * scale;
    return { glyph, x: at, advance: x - at };
  });
}

// opentype.js 2.0's Path.toPathData() sometimes writes "NaN" for valid points,
// so serialise the commands ourselves. Each contour is closed explicitly.
function pathData(glyph, x, y, size) {
  const n = (v) => Number(v).toFixed(2);
  return glyph
    .getPath(x, y, size)
    .commands.map((c) => {
      switch (c.type) {
        case "M": return `M${n(c.x)} ${n(c.y)}`;
        case "L": return `L${n(c.x)} ${n(c.y)}`;
        case "Q": return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case "C": return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        case "Z": return "Z";
        default: throw new Error(`unknown path command ${c.type}`);
      }
    })
    .join("")
    .replace(/(?<!Z)(?=M)(?!^)/g, "Z")
    .replace(/([^Z])$/, "$1Z");
}

/**
 * The wordmark as SVG markup: one path per letter, crayon fills, a thick ink
 * outline and a hard ink shadow, with a small kid-poster wobble.
 * Returns { svg, width, height } in its own coordinate space.
 */
function wordmark(text, size) {
  const stroke = size * 0.09;
  const shadow = size * 0.06;
  const pad = stroke + shadow;
  const glyphs = layout(text, display, size);
  const ascent = (display.ascender / display.unitsPerEm) * size;
  const descent = (-display.descender / display.unitsPerEm) * size;
  const baseline = pad + ascent * 0.92;
  let x = pad;
  const letters = [];
  glyphs.forEach(({ glyph, advance }, i) => {
    const wobble = [-4, 3, -2, 4, -3][i % 5];
    const lift = [0, -0.04, 0.02, -0.02, 0.03][i % 5] * size;
    const d = pathData(glyph, x, baseline + lift, size);
    const cx = x + advance / 2;
    const cy = baseline - ascent / 3;
    letters.push({ d, fill: CRAYONS[i % CRAYONS.length], transform: `rotate(${wobble} ${cx.toFixed(1)} ${cy.toFixed(1)})` });
    x += advance - size * 0.02;
  });
  const width = Math.ceil(x + pad);
  const height = Math.ceil(baseline + descent * 0.35 + pad);
  const shadowLayer = letters
    .map((l) => `<path d="${l.d}" transform="translate(${shadow * 0.5} ${shadow}) ${l.transform}" fill="${C.ink}" stroke="${C.ink}" stroke-width="${stroke * 2}" stroke-linejoin="round"/>`)
    .join("");
  const letterLayer = letters
    .map((l) => `<path d="${l.d}" transform="${l.transform}" fill="${l.fill}" stroke="${C.ink}" stroke-width="${stroke * 2}" stroke-linejoin="round" paint-order="stroke"/>`)
    .join("");
  return { svg: `<g>${shadowLayer}${letterLayer}</g>`, width, height };
}

/** Plain text as a single path (for taglines), left-aligned at (x, baseline). */
function textPath(text, x, baseline, size, fill, font = body) {
  const d = layout(text, font, size)
    .map(({ glyph, x: gx }) => pathData(glyph, x + gx, baseline, size))
    .join("");
  return `<path d="${d}" fill="${fill}"/>`;
}
function textWidth(text, size, font = body) {
  return layout(text, font, size).reduce((sum, g) => sum + g.advance, 0);
}

const markSvg = readFileSync(path.join(outDir, "logo-mark.svg"), "utf8");
const markInner = markSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
/** The 128×128 mark placed at (x, y) with side `s`. */
const mark = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 128})">${markInner}</g>`;

async function png(svg, file, size) {
  const [w, h] = Array.isArray(size) ? size : [size, size];
  await sharp(Buffer.from(svg), { density: 300 }).resize(w, h).png({ compressionLevel: 9 }).toFile(path.join(outDir, file));
  console.log(`  ${file} (${w}×${h})`);
}

// 1. Wordmark SVG
const wm = wordmark(brand.name, 120);
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wm.width} ${wm.height}" role="img" aria-label="${brand.name}">${wm.svg}</svg>\n`;
writeFileSync(path.join(outDir, "logo.svg"), logoSvg);
console.log(`  logo.svg (${wm.width}×${wm.height})`);

// 2. Icons. Favicon: the mark alone. Home-screen icons: mark on paper.
await png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${markInner}</svg>`, "icon-32.png", 32);
const onPaper = (inset) => {
  const s = 512 - inset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${C.paper}"/>${mark(inset, inset + s * 0.02, s)}</svg>`;
};
await png(onPaper(56), "icon-180.png", 180);
await png(onPaper(56), "icon-192.png", 192);
await png(onPaper(56), "icon-512.png", 512);
// Maskable: launchers crop to a circle/squircle, keep the mark inside the middle 60%.
await png(onPaper(102), "icon-512-maskable.png", 512);

// 3. Open Graph share image, 1200×630.
{
  const W = 1200;
  const H = 630;
  const dots = [
    [90, 80, 18, C.sun], [1110, 70, 14, C.sky], [1140, 560, 20, C.grass], [70, 560, 12, C.grape],
    [600, 40, 10, C.tomato], [1020, 330, 9, C.grape], [140, 330, 8, C.sky], [700, 600, 11, C.sun],
  ]
    .map(([x, y, r, fill]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${C.ink}" stroke-width="4"/>`)
    .join("");
  const big = wordmark(brand.name, 150);
  const scale = Math.min(1, 760 / big.width);
  const wmW = big.width * scale;
  const wmX = (W - wmW) / 2 + 80;
  const markSize = 200;
  const tagline = "Little games made by";
  const makers = brand.makers.length > 1
    ? `${brand.makers.slice(0, -1).join(", ")} & ${brand.makers.at(-1)}`
    : brand.makers.join("");
  const sub = "Free  ·  No ads  ·  Tap and play";
  const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.paper}"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="40" fill="none" stroke="${C.ink}" stroke-width="6" stroke-dasharray="2 18" stroke-linecap="round"/>
  ${dots}
  ${mark(wmX - markSize - 10, 120, markSize)}
  <g transform="translate(${wmX} 140) scale(${scale})">${big.svg}</g>
  ${textPath(tagline, (W - textWidth(tagline, 46)) / 2, 400, 46, C.ink)}
  ${textPath(makers, (W - textWidth(makers, 64, display)) / 2, 475, 64, C.tomato, display)}
  ${textPath(sub, (W - textWidth(sub, 34)) / 2, 545, 34, "#5C4A3A")}
</svg>`;
  await png(og, "og-1200x630.png", [W, H]);
}

console.log("Brand set written to apps/player-web/public/brand/");
