#!/usr/bin/env node
// Sets KEY=VALUE pairs in a dotenv file without printing any values.
//   import { setEnv } from "./lib/set-env.mjs"; setEnv(file, { KEY: value })
//   node scripts/lib/set-env.mjs <file> KEY=VALUE [KEY=VALUE ...]
// Prefer the import: values on a command line can show up in `ps`. Existing keys are
// replaced in place, new keys are appended, other lines are kept. The previous file is
// copied to <file>.bak first, and the file is written readable by you only.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** @param {string} file @param {Record<string, string>} values */
export function setEnv(file, values) {
  const pairs = new Map(Object.entries(values));
  const lines = existsSync(file) ? readFileSync(file, "utf8").replace(/\n+$/, "").split("\n") : [];
  if (existsSync(file)) copyFileSync(file, `${file}.bak`);
  const seen = new Set();
  const out = lines.map((line) => {
    const key = line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1];
    if (key && pairs.has(key)) {
      seen.add(key);
      return `${key}=${pairs.get(key)}`;
    }
    return line;
  });
  for (const [key, value] of pairs) if (!seen.has(key)) out.push(`${key}=${value}`);
  writeFileSync(file, out.join("\n").replace(/\n*$/, "\n"), { mode: 0o600 });
  console.log(`updated ${file}: ${[...pairs.keys()].join(", ")}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [file, ...args] = process.argv.slice(2);
  if (!file || args.length === 0) {
    console.error("usage: set-env.mjs <file> KEY=VALUE...");
    process.exit(2);
  }
  /** @type {Record<string, string>} */
  const values = {};
  for (const arg of args) {
    const eq = arg.indexOf("=");
    if (eq < 1) throw new Error(`not KEY=VALUE: ${arg.split("=")[0]}`);
    values[arg.slice(0, eq)] = arg.slice(eq + 1);
  }
  setEnv(file, values);
}
