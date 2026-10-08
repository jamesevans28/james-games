#!/usr/bin/env node
// T3.1: rewrite the old neo-arcade palette classes (flingo-*, neon-*, candy-*,
// surface-*) to the sticker-book semantic tokens defined in
// apps/player-web/src/index.css. Mapping is by role, not by number: the old
// flingo scale was inverted (50 = darkest surface, 900 = lightest text).
//
// Usage: node scripts/codemod-brand-classes.mjs [--dry]
// Safe to re-run: it only touches tokens that still use the old names.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const dry = process.argv.includes("--dry");

const files = execFileSync("git", ["ls-files", "apps/player-web/src", "apps/admin-web/src"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((f) => /\.(tsx?|jsx?)$/.test(f));

const TEXTISH = new Set(["text", "placeholder", "fill", "stroke", "caret", "decoration"]);
const LINEISH = new Set([
  "border",
  "border-t",
  "border-b",
  "border-l",
  "border-r",
  "border-x",
  "border-y",
  "divide",
  "ring",
  "outline",
  "ring-offset",
]);

/** @returns {{ token: string, keepOpacity: boolean } | null} */
function mapColor(utility, family, name, opacity) {
  if (family === "flingo") {
    const shade = Number(name);
    if (TEXTISH.has(utility)) {
      if (shade >= 800) return { token: "ink", keepOpacity: true };
      if (shade >= 600) return { token: "ink-2", keepOpacity: true };
      return { token: "ink-3", keepOpacity: true };
    }
    if (LINEISH.has(utility)) {
      return { token: shade <= 300 ? "line" : "ink-3", keepOpacity: false };
    }
    // bg / from / via / to / shadow
    if (shade <= 100) return { token: "paper-2", keepOpacity: false };
    if (shade <= 300) return { token: "line", keepOpacity: true };
    return { token: "ink-3", keepOpacity: true };
  }
  if (family === "neon") {
    const map = {
      lime: "brand",
      pink: "grape",
      blue: "sky",
      yellow: "sun",
      orange: "tomato",
      purple: "grape",
    };
    return map[name] ? { token: map[name], keepOpacity: true } : null;
  }
  if (family === "candy") {
    const map = { pink: "grape", yellow: "sun", mint: "grass", sky: "sky" };
    return map[name] ? { token: map[name], keepOpacity: true } : null;
  }
  if (family === "surface") {
    if (name === "card") return { token: "card", keepOpacity: true };
    if (name === "elevated") return { token: "paper-2", keepOpacity: true };
    if (name === "dark") {
      if (utility === "text") return { token: "on-brand", keepOpacity: true };
      // Translucent dark layers were scrims over images or the page.
      if (utility === "bg" && opacity !== undefined && Number(opacity) <= 80) {
        return { token: "scrim", keepOpacity: true };
      }
      return { token: "paper", keepOpacity: true };
    }
  }
  return null;
}

const COLOR_RE =
  /(?<![\w-])((?:text|placeholder|fill|stroke|caret|decoration|bg|from|via|to|border(?:-[tblrxy])?|divide|ring(?:-offset)?|outline)-)(flingo|neon|candy|surface)-([a-z0-9]+)(?:\/(\d+))?(?![\w-])/g;

const SHADOW_RE = /(?<![\w-])shadow-neon-[a-z]+(?:\/\d+)?(?![\w-])/g;
const GLOW_RE = /\s?(?<![\w-])text-glow-[a-z]+(?![\w-])/g;

let changedFiles = 0;
let replacements = 0;
const unmapped = new Set();

for (const file of files) {
  const before = readFileSync(file, "utf8");
  let after = before.replace(COLOR_RE, (match, prefix, family, name, opacity) => {
    const utility = prefix.slice(0, -1);
    const mapped = mapColor(utility, family, name, opacity);
    if (!mapped) {
      unmapped.add(match);
      return match;
    }
    replacements++;
    const suffix = mapped.keepOpacity && opacity ? `/${opacity}` : "";
    return `${prefix}${mapped.token}${suffix}`;
  });
  after = after.replace(SHADOW_RE, () => {
    replacements++;
    return "shadow-sticker";
  });
  after = after.replace(GLOW_RE, () => {
    replacements++;
    return "";
  });
  if (after !== before) {
    changedFiles++;
    if (!dry) writeFileSync(file, after);
  }
}

console.log(`${dry ? "[dry] " : ""}${replacements} replacements in ${changedFiles} files`);
if (unmapped.size) console.log("Unmapped (fix by hand):", [...unmapped].join(" "));
