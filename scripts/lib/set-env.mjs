#!/usr/bin/env node
// Sets KEY=VALUE pairs in a dotenv file without printing any values.
//   node scripts/lib/set-env.mjs <file> KEY=VALUE [KEY=VALUE ...]
//   node scripts/lib/set-env.mjs <file> --from-json <service-account.json>
// Existing keys are replaced in place, new keys are appended, other lines are
// kept. The previous file is copied to <file>.bak first.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const [file, ...args] = process.argv.slice(2);
if (!file || args.length === 0) {
  console.error("usage: set-env.mjs <file> KEY=VALUE... | --from-json <service-account.json>");
  process.exit(2);
}

const pairs = new Map();
if (args[0] === "--from-json") {
  const sa = JSON.parse(readFileSync(args[1], "utf8"));
  pairs.set("FIREBASE_PROJECT_ID", sa.project_id);
  pairs.set("FIREBASE_CLIENT_EMAIL", sa.client_email);
  // dotenv keeps \n escapes inside double quotes; the backend turns them back into newlines.
  pairs.set("FIREBASE_PRIVATE_KEY", `"${String(sa.private_key).replace(/\n/g, "\\n")}"`);
} else {
  for (const arg of args) {
    const eq = arg.indexOf("=");
    if (eq < 1) throw new Error(`not KEY=VALUE: ${arg.split("=")[0]}`);
    pairs.set(arg.slice(0, eq), arg.slice(eq + 1));
  }
}

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
