// Text as SVG paths (no fonts needed at render time), shared by the brand and art scripts.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import opentype from "opentype.js";

const require = createRequire(import.meta.url);

export function loadFont(file) {
  const buf = readFileSync(require.resolve(file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}
export const display = loadFont("@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff");
export const body = loadFont("@fontsource/nunito/files/nunito-latin-800-normal.woff");

// opentype.js's shaper chokes on these fonts' ccmp lookups, so lay glyphs out by
// hand (char → glyph, plus kerning). Latin text only, which is all we draw.
export function layout(text, font, size) {
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
export function pathData(glyph, x, y, size) {
  const n = (v) => Number(v).toFixed(2);
  return glyph
    .getPath(x, y, size)
    .commands.map((c) => {
      switch (c.type) {
        case "M":
          return `M${n(c.x)} ${n(c.y)}`;
        case "L":
          return `L${n(c.x)} ${n(c.y)}`;
        case "Q":
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case "C":
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        case "Z":
          return "Z";
        default:
          throw new Error(`unknown path command ${c.type}`);
      }
    })
    .join("")
    .replace(/(?<!Z)(?=M)(?!^)/g, "Z")
    .replace(/([^Z])$/, "$1Z");
}

/** Plain text as a single path (for taglines), left-aligned at (x, baseline). */
export function textPath(text, x, baseline, size, fill, font = body) {
  const d = layout(text, font, size)
    .map(({ glyph, x: gx }) => pathData(glyph, x + gx, baseline, size))
    .join("");
  return `<path d="${d}" fill="${fill}"/>`;
}
export function textWidth(text, size, font = body) {
  return layout(text, font, size).reduce((sum, g) => sum + g.advance, 0);
}
