import { describe, expect, it } from "vitest";
import {
  atlasJson,
  floodRemoveBackground,
  fullPrompt,
  hexToRgb,
  looksLikeCheckerboard,
  nearestColour,
  packFrames,
  PALETTE,
  readPrompts,
} from "./lib.mjs";

function canvas(w, h, rgb) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) data.set([...rgb, 255], i);
  return data;
}

describe("art lib", () => {
  it("snaps colours to the crayon box", () => {
    expect(nearestColour(250, 90, 80)).toEqual(hexToRgb(PALETTE.tomato));
    expect(nearestColour(30, 30, 25)).toEqual(hexToRgb(PALETTE.ink));
    expect(nearestColour(255, 250, 240)).toEqual(hexToRgb(PALETTE.paper));
  });

  it("removes the paper but not what's inside the ink outline", () => {
    const w = 40;
    const data = canvas(w, w, hexToRgb(PALETTE.paper));
    const set = (x, y, rgb) => data.set([...rgb, 255], (y * w + x) * 4);
    // An ink ring around a paper-coloured centre (like an eye white).
    for (let y = 10; y < 30; y++)
      for (let x = 10; x < 30; x++) {
        const edge = x === 10 || x === 29 || y === 10 || y === 29;
        if (edge) set(x, y, hexToRgb(PALETTE.ink));
      }
    floodRemoveBackground(data, w, w);
    expect(data[3]).toBe(0); // corner cleared
    expect(data[(20 * w + 20) * 4 + 3]).toBe(255); // inside kept
    expect(data[(10 * w + 10) * 4 + 3]).toBe(255); // outline kept
  });

  it("spots a painted checkerboard", () => {
    const w = 128;
    const data = canvas(w, w, [255, 255, 255]);
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++)
        if ((Math.floor(x / 8) + Math.floor(y / 8)) % 2)
          data.set([204, 204, 204, 255], (y * w + x) * 4);
    expect(looksLikeCheckerboard(data, w, w)).toBe(true);
    expect(looksLikeCheckerboard(canvas(w, w, [255, 248, 236]), w, w)).toBe(false);
  });

  it("packs frames without overlap into a Phaser atlas", () => {
    const frames = ["a", "b", "c"].map((name) => ({ name, w: 512, h: 512 }));
    const { placed, width, height } = packFrames(frames, 1100);
    expect(width).toBeLessThanOrEqual(1100);
    expect(height).toBeGreaterThan(512);
    const json = atlasJson(placed, "x.png", width, height);
    expect(Object.keys(json.frames)).toEqual(["a", "b", "c"]);
  });

  it("reads 12 cover prompts that all start with the base prompt", () => {
    const covers = readPrompts("covers");
    expect(covers).toHaveLength(12);
    for (const c of covers) expect(fullPrompt(c)).toMatch(/^A simple drawing of .+7-year-old/);
  });
});
