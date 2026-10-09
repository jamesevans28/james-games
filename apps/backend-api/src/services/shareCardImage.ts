import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype, { type Font, type Glyph } from "opentype.js";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
import { formatScore, SHARE_DESCRIPTION, type ShareCard } from "./shareCard.js";

/**
 * The share card image (T11.5): a 1200×630 PNG drawn as SVG and rasterised by
 * resvg (WebAssembly, no native code). Text is turned into paths with opentype.js
 * from the brand fonts (Baloo 2 and Nunito, the same WOFF files the brand scripts
 * use), so nothing depends on fonts installed on the server.
 *
 * Assets: in the Lambda bundle the fonts and the .wasm sit next to lambda.mjs
 * (scripts/bundle.mjs copies them under the names below); in dev and tests they
 * come from node_modules.
 */

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** Bundled file name → package path. scripts/bundle.mjs copies the same list. */
export const SHARE_CARD_ASSETS = {
  "share-display.woff": "@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff",
  "share-body.woff": "@fontsource/nunito/files/nunito-latin-800-normal.woff",
  "resvg.wasm": "@resvg/resvg-wasm/index_bg.wasm",
} as const;

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

export type CardFonts = { display: Font; body: Font };

const here = path.dirname(fileURLToPath(import.meta.url));
const requireFrom = createRequire(import.meta.url);

function assetPath(name: keyof typeof SHARE_CARD_ASSETS): string {
  const bundled = path.join(here, name);
  return existsSync(bundled) ? bundled : requireFrom.resolve(SHARE_CARD_ASSETS[name]);
}

function readAsset(name: keyof typeof SHARE_CARD_ASSETS): ArrayBuffer {
  const buf = readFileSync(assetPath(name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

export function loadCardFonts(): CardFonts {
  return {
    display: opentype.parse(readAsset("share-display.woff")),
    body: opentype.parse(readAsset("share-body.woff")),
  };
}

// --- Text as paths -----------------------------------------------------------

type Placed = { glyph: Glyph; x: number; advance: number };

// opentype.js's shaper chokes on these fonts' ccmp lookups (scripts/lib/text.mjs),
// so glyphs are laid out by hand: char → glyph, plus kerning.
function layout(text: string, font: Font, size: number): Placed[] {
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

export function textWidth(text: string, font: Font, size: number): number {
  return layout(text, font, size).reduce((sum, g) => sum + g.advance, 0);
}

/** True when the font has a glyph for every character (the brand fonts are Latin only). */
export function canDraw(text: string, font: Font): boolean {
  return Array.from(text).every((ch) => /\s/.test(ch) || font.charToGlyphIndex(ch) > 0);
}

const n = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "0");

// Path.toPathData() sometimes writes "NaN" for valid points, so serialise by hand.
function glyphPath(glyph: Glyph, x: number, y: number, size: number): string {
  return glyph
    .getPath(x, y, size)
    .commands.map((c) => {
      switch (c.type) {
        case "M":
        case "L":
          return `${c.type}${n(c.x)} ${n(c.y)}`;
        case "Q":
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case "C":
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        default:
          return "Z";
      }
    })
    .join("")
    .replace(/(?<!Z)(?=M)(?!^)/g, "Z") // close every contour, so outlines have no gaps
    .replace(/([^Z])$/, "$1Z");
}

/** Path data for a line of text centred on `cx` (or starting at `x` with align "start"). */
function textD(
  text: string,
  font: Font,
  size: number,
  x: number,
  baseline: number,
  align: "middle" | "start" | "end" = "middle",
): string {
  const placed = layout(text, font, size);
  const width = placed.reduce((sum, g) => sum + g.advance, 0);
  const left = align === "middle" ? x - width / 2 : align === "end" ? x - width : x;
  return placed.map((g) => glyphPath(g.glyph, left + g.x, baseline, size)).join("");
}

/** The largest size from `max` down to `min` at which the text fits `maxWidth`. */
function fitSize(text: string, font: Font, max: number, maxWidth: number, min = 28): number {
  let size = max;
  while (size > min && textWidth(text, font, size) > maxWidth) size -= 4;
  return size;
}

/** Shortens text that would still overflow at the smallest size. */
function clip(text: string, font: Font, size: number, maxWidth: number): string {
  if (textWidth(text, font, size) <= maxWidth) return text;
  let chars = Array.from(text);
  while (chars.length > 1 && textWidth(`${chars.join("").trimEnd()}…`, font, size) > maxWidth) {
    chars = chars.slice(0, -1);
  }
  return `${chars.join("").trimEnd()}…`;
}

// --- The card ----------------------------------------------------------------

const CONFETTI = [
  { x: 92, y: 96, r: 14, fill: C.sun },
  { x: 150, y: 70, r: 8, fill: C.sky },
  { x: 1112, y: 104, r: 16, fill: C.grass },
  { x: 1060, y: 66, r: 9, fill: C.tomato },
  { x: 1130, y: 380, r: 10, fill: C.grape },
  { x: 74, y: 360, r: 11, fill: C.sky },
  { x: 110, y: 430, r: 7, fill: C.tomato },
];

/** The card as SVG markup. Text that the fonts can't draw falls back to plain words. */
export function buildShareSvg(card: ShareCard, fonts: CardFonts, siteHost: string): string {
  const { display, body } = fonts;
  const cx = CARD_WIDTH / 2;
  const hasRemix = Boolean(card.remixName && canDraw(card.remixName, body));

  const titleText = canDraw(card.gameTitle, display) ? card.gameTitle : "Games";
  const titleSize = fitSize(titleText, display, 96, 960, 48);
  const title = clip(titleText, display, titleSize, 960);
  const titleBaseline = hasRemix ? 140 : 162;

  const remix = hasRemix ? clip(`Remix: ${card.remixName}`, body, 40, 900) : null;

  const scoreText = formatScore(card.score);
  const scoreSize = fitSize(scoreText, display, 230, 900, 120);
  const scoreBaseline = 400;

  const name = card.playerName && canDraw(card.playerName, body) ? card.playerName : null;
  const byText = clip(name ? `by ${name}` : "by a player", body, 50, 900);

  const pillText = SHARE_DESCRIPTION;
  const pillSize = 46;
  const pillWidth = textWidth(pillText, display, pillSize) + 64;
  const pillX = 72;
  const pillY = 506;

  const scoreD = textD(scoreText, display, scoreSize, cx, scoreBaseline);
  const confetti = CONFETTI.map(
    (d) =>
      `<circle cx="${d.x}" cy="${d.y}" r="${d.r}" fill="${d.fill}" stroke="${C.ink}" stroke-width="3"/>`,
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${C.paper2}"/>
<rect x="24" y="24" width="${CARD_WIDTH - 48}" height="${CARD_HEIGHT - 48}" rx="40" fill="${C.paper}" stroke="${C.ink}" stroke-width="6"/>
${confetti}
<path d="${textD(title, display, titleSize, cx, titleBaseline)}" fill="${C.ink}"/>
${remix ? `<path d="${textD(remix, body, 40, cx, 196)}" fill="${C.grape}"/>` : ""}
<path d="${scoreD}" transform="translate(6 10)" fill="${C.ink}" stroke="${C.ink}" stroke-width="22" stroke-linejoin="round"/>
<path d="${scoreD}" fill="${C.tomato}" stroke="${C.ink}" stroke-width="22" stroke-linejoin="round" paint-order="stroke"/>
<path d="${textD(byText, body, 50, cx, 490)}" fill="${C.ink}"/>
<rect x="${pillX + 4}" y="${pillY + 6}" width="${n(pillWidth)}" height="76" rx="38" fill="${C.ink}"/>
<rect x="${pillX}" y="${pillY}" width="${n(pillWidth)}" height="76" rx="38" fill="${C.sun}" stroke="${C.ink}" stroke-width="5"/>
<path d="${textD(pillText, display, pillSize, pillX + 32, pillY + 54, "start")}" fill="${C.ink}"/>
<path d="${textD(siteHost, body, 34, CARD_WIDTH - 76, pillY + 52, "end")}" fill="${C.ink}" fill-opacity="0.75"/>
</svg>`;
}

// --- Rendering -----------------------------------------------------------------

let ready: Promise<CardFonts> | null = null;

/** Loads the WebAssembly rasteriser and the fonts once per Lambda container. */
function renderKit(): Promise<CardFonts> {
  ready ??= (async () => {
    await initWasm(readFileSync(assetPath("resvg.wasm")));
    return loadCardFonts();
  })().catch((err: unknown) => {
    ready = null;
    throw err;
  });
  return ready;
}

/** The card as a 1200×630 PNG. */
export async function renderSharePng(card: ShareCard, siteHost: string): Promise<Buffer> {
  const fonts = await renderKit();
  const resvg = new Resvg(buildShareSvg(card, fonts, siteHost), {
    fitTo: { mode: "original" },
    font: { loadSystemFonts: false },
  });
  const image = resvg.render();
  try {
    return Buffer.from(image.asPng());
  } finally {
    image.free();
    resvg.free();
  }
}
