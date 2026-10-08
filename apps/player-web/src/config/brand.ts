import brandJson from "./brand.json";

/**
 * Every brand string, colour and asset path lives here (and in brand.json, which
 * the Vite config and repo scripts read directly). Never hard-code the brand
 * name, origin, colours or analytics id anywhere else.
 */
export const brand = {
  ...brandJson,
  makers: brandJson.makers as readonly string[],
  // GA4 stream; VITE_ANALYTICS_ID overrides it (empty string turns analytics off).
  // `?.`: scripts import manifests (and so this file) under tsx, where import.meta.env is unset.
  analyticsId: import.meta.env?.VITE_ANALYTICS_ID ?? brandJson.analyticsId,
  social: {} as Record<string, string>, // no handles until there are real ones
} as const;

/** "James, Tilly & Harvey" */
export function makersLine(makers: readonly string[] = brand.makers): string {
  if (makers.length <= 1) return makers.join("");
  return `${makers.slice(0, -1).join(", ")} & ${makers[makers.length - 1]}`;
}

/** Absolute URL on the public site, for canonical links and share text. */
export function siteUrl(path = "/"): string {
  return new URL(path, brand.origin).toString();
}

/** Font stacks for Phaser text objects (Phase 4 scenes read these). */
export const BRAND_FONTS = {
  display: `"${brand.fonts.display}", "${brand.fonts.body}", Arial, sans-serif`,
  body: `"${brand.fonts.body}", Arial, sans-serif`,
  note: `"${brand.fonts.note}", "${brand.fonts.body}", cursive`,
} as const;

/** Sticker-book palette for canvas code that cannot read CSS variables. */
export const BRAND_COLORS = {
  paper: "#FFF8EC",
  ink: "#2B2118",
  tomato: "#FF5A4E",
  sun: "#FFC93C",
  grass: "#3DBE6B",
  sky: "#3FA9F5",
  grape: "#8E6CEF",
} as const;
