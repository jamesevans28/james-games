const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "src", "games", "word-rush", "data");

function shouldKeep(entry) {
  // Remove if contains apostrophe or hyphen or any digit
  if (entry.includes("'") || entry.includes("-")) return false;
  if (/[0-9]/.test(entry)) return false;

  // Split on spaces, check each word length > 9
  const words = entry.split(/\s+/);
  for (const w of words) {
    if (w.length > 9) return false;
  }
  return true;
}

function processFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  // Match export const name = [ ... ]; including multiline
  const m = text.match(/export const\s+(\w+)\s*=\s*\[([\s\S]*?)\];/m);
  if (!m) return null;
  const name = m[1];
  const arrayBody = m[2];
  // Extract string entries
  const entries = [];
  const entryRegex = /"([^"]*)"/g;
  let em;
  while ((em = entryRegex.exec(arrayBody)) !== null) {
    entries.push(em[1]);
  }

  const kept = entries.filter((e) => shouldKeep(e));

  // Rebuild file content with same export name
  const newArray = kept.map((s) => `  "${s}",`).join("\n");
  const newText = text.replace(m[0], `export const ${name} = [\n${newArray}\n];`);
  fs.writeFileSync(filePath, newText, "utf8");
  return { file: path.relative(DATA_DIR, filePath), before: entries.length, after: kept.length };
}

const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts");
const summary = [];
for (const f of files) {
  const res = processFile(path.join(DATA_DIR, f));
  if (res) summary.push(res);
}

console.log("Filtered files:");
summary.forEach((s) => console.log(`${s.file}: ${s.before} -> ${s.after}`));
