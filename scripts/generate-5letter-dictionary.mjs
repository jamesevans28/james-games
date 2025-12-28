import fs from "node:fs";
import path from "node:path";

import wordListPath from "word-list";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "apps/player-web/src/game/words");
const OUT_FILE = path.join(OUT_DIR, "wordlist-5.txt");

const raw = fs.readFileSync(wordListPath, "utf8");
const words = raw
  .split(/\r?\n/)
  .map((w) => w.trim())
  .filter(Boolean)
  .map((w) => w.toUpperCase())
  .filter((w) => /^[A-Z]{5}$/.test(w));

// Unique + stable order
const unique = Array.from(new Set(words)).sort();

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, unique.join("\n") + "\n", "utf8");

console.log(`Wrote ${unique.length} words to ${path.relative(ROOT, OUT_FILE)}`);
