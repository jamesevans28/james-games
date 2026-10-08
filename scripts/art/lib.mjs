// Shared helpers for the art scripts (Phase 8). Pure pixel functions are exported
// for tests (lib.test.mjs); file helpers wrap sharp.
import { readFileSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const PUBLIC = path.join(ROOT, "apps/player-web/public");
export const INBOX = path.join(ROOT, "art-inbox");

/** The crayon box (docs/art/STYLE.md). Order matters only for ties. */
export const PALETTE = {
  paper: "#FFF8EC",
  ink: "#2B2118",
  tomato: "#FF5A4E",
  sun: "#FFC93C",
  grass: "#3DBE6B",
  sky: "#3FA9F5",
  grape: "#8E6CEF",
  skin: "#F2B58A",
  wood: "#B5783F",
  white: "#FFFFFF",
};

export function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const PALETTE_RGB = Object.values(PALETTE).map(hexToRgb);

/** Nearest palette colour by weighted RGB distance (cheap and good enough for flat crayon fills). */
export function nearestColour(r, g, b, palette = PALETTE_RGB) {
  let best = palette[0];
  let bestD = Infinity;
  for (const c of palette) {
    const dr = r - c[0];
    const dg = g - c[1];
    const db = b - c[2];
    const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Snaps every opaque pixel of an RGBA buffer to the palette, in place. */
export function quantise(data, palette = PALETTE_RGB) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [r, g, b] = nearestColour(data[i], data[i + 1], data[i + 2], palette);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return data;
}

/**
 * True when the corners look like a fake-transparency checkerboard (some image
 * tools paint one instead of real alpha). Samples a 4×4 grid in each corner.
 */
export function looksLikeCheckerboard(data, width, height) {
  const corners = [
    [0, 0],
    [width - 32, 0],
    [0, height - 32],
    [width - 32, height - 32],
  ];
  let hits = 0;
  for (const [cx, cy] of corners) {
    const lum = [];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const i = ((cy + y * 8) * width + (cx + x * 8)) * 4;
        lum.push(data[i] + data[i + 1] + data[i + 2]);
      }
    }
    const lo = Math.min(...lum);
    const hi = Math.max(...lum);
    // Two distinct light greys alternating, opaque: a painted checkerboard.
    const opaque = data[(cy * width + cx) * 4 + 3] === 255;
    if (opaque && hi - lo > 30 && lo > 400) hits++;
  }
  return hits >= 3;
}

/**
 * Background removal for drawings on plain paper: flood-fills from every edge
 * pixel through colours within `tolerance` of the corner colour and makes them
 * transparent. Thick ink outlines stop the fill, so the subject stays whole.
 * Returns the number of pixels cleared.
 */
export function floodRemoveBackground(data, width, height, tolerance = 48) {
  const [br, bg, bb] = [data[0], data[1], data[2]];
  const near = (i) =>
    Math.abs(data[i] - br) + Math.abs(data[i + 1] - bg) + Math.abs(data[i + 2] - bb) <= tolerance;
  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  let cleared = 0;
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    if (!near(i)) continue;
    data[i + 3] = 0;
    cleared++;
    const x = p % width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (p >= width) stack.push(p - width);
    if (p < width * (height - 1)) stack.push(p + width);
  }
  return cleared;
}

/** Simple shelf packer for equal or mixed frame sizes. Returns placements and the sheet size. */
export function packFrames(frames, maxWidth = 2048, padding = 2) {
  const sorted = [...frames].sort((a, b) => b.h - a.h || a.name.localeCompare(b.name));
  let x = padding;
  let y = padding;
  let shelf = 0;
  let width = 0;
  const placed = [];
  for (const f of sorted) {
    if (x + f.w + padding > maxWidth) {
      x = padding;
      y += shelf + padding;
      shelf = 0;
    }
    placed.push({ ...f, x, y });
    x += f.w + padding;
    shelf = Math.max(shelf, f.h);
    width = Math.max(width, x);
  }
  return { placed, width, height: y + shelf + padding };
}

/** Phaser atlas (JSON hash) for packed frames. */
export function atlasJson(placed, image, width, height) {
  const frames = {};
  for (const f of placed.sort((a, b) => a.name.localeCompare(b.name))) {
    frames[f.name] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h },
    };
  }
  return {
    frames,
    meta: {
      app: "games4james scripts/art/sheet.mjs",
      image,
      format: "RGBA8888",
      size: { w: width, h: height },
      scale: "1",
    },
  };
}

/** Reads docs/art/prompts/<category>.md into [{ name, subject, composition, output }]. */
export function readPrompts(category) {
  const file = path.join(ROOT, "docs/art/prompts", `${category}.md`);
  const text = readFileSync(file, "utf8");
  const entries = [];
  for (const block of text.split(/^### /m).slice(1)) {
    const [nameLine, ...rest] = block.split("\n");
    const field = (key) =>
      rest
        .find((l) => l.startsWith(`${key}:`))
        ?.slice(key.length + 1)
        .trim();
    entries.push({
      name: nameLine.trim(),
      subject: field("Subject") ?? "",
      composition: field("Composition"),
      output: field("Output"),
    });
  }
  return entries;
}

export const BASE_PROMPT =
  "A simple drawing of {subject}, as if drawn by a 7-year-old with thick black marker outlines and flat crayon colours, cheerful, on a plain cream paper background, centred, full body, no text, no shadows, no gradients. Colours limited to coral red, sunflower yellow, grass green, sky blue, grape purple, black outline.";

export function fullPrompt(entry) {
  return [BASE_PROMPT.replace("{subject}", entry.subject), entry.composition]
    .filter(Boolean)
    .join(" ");
}

/** Flags that never take a value, so `--dry-run covers` keeps `covers` positional. */
const SWITCHES = new Set(["dry-run", "force", "quantise", "no-quantise", "no-shadow"]);

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    const [k, v] = a.slice(2).split("=");
    if (v !== undefined) flags[k] = v;
    else if (SWITCHES.has(k) || !argv[i + 1] || argv[i + 1].startsWith("--")) flags[k] = true;
    else flags[k] = argv[++i];
  }
  return { flags, positional };
}
