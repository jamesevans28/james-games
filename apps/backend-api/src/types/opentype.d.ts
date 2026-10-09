// The small part of opentype.js 2 (a root dev dependency, bundled into the Lambda)
// that the share card uses (T11.5). The package ships no types.
declare module "opentype.js" {
  export type PathCommand =
    | { type: "M" | "L"; x: number; y: number }
    | { type: "Q"; x1: number; y1: number; x: number; y: number }
    | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: "Z" };

  export interface Glyph {
    advanceWidth: number;
    getPath(x: number, y: number, fontSize: number): { commands: PathCommand[] };
  }

  export interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    charToGlyph(char: string): Glyph;
    charToGlyphIndex(char: string): number;
    getKerningValue(left: Glyph, right: Glyph): number;
  }

  const opentype: { parse(buffer: ArrayBuffer): Font };
  export default opentype;
}
