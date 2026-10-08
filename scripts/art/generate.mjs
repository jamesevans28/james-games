#!/usr/bin/env node
/**
 * T8.2: one prompt source for both workflows.
 *   node scripts/art/generate.mjs --dry-run covers            print the prompts (Option A: paste them by hand)
 *   node scripts/art/generate.mjs covers [--only snapadile]   call the image API (Option B, costs money)
 * Option B needs IMAGE_API_KEY (an OpenAI key) in apps/backend-api/.env.local or the environment.
 * Writes raw images to art-inbox/<category>/<name>.png (gitignored). Never runs in CI.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { INBOX, ROOT, fullPrompt, parseArgs, readPrompts } from "./lib.mjs";

const { flags, positional } = parseArgs(process.argv.slice(2));
const category = positional[0];
if (!category) {
  console.error(
    "Usage: generate.mjs [--dry-run] <covers|sprites|avatars|stickers|logo> [--only name]",
  );
  process.exit(2);
}
let entries = readPrompts(category);
if (flags.only) entries = entries.filter((e) => String(flags.only).split(",").includes(e.name));

if (flags["dry-run"]) {
  for (const e of entries) console.log(`### ${e.name}\n${fullPrompt(e)}\n`);
  console.log(`${entries.length} prompts`);
  process.exit(0);
}

function apiKey() {
  if (process.env.IMAGE_API_KEY) return process.env.IMAGE_API_KEY;
  const env = path.join(ROOT, "apps/backend-api/.env.local");
  if (!existsSync(env)) return undefined;
  const line = readFileSync(env, "utf8")
    .split("\n")
    .find((l) => l.startsWith("IMAGE_API_KEY="));
  return line?.slice("IMAGE_API_KEY=".length).replace(/^"|"$/g, "").trim() || undefined;
}

const key = apiKey();
if (!key) {
  console.error(
    "IMAGE_API_KEY is not set. Use --dry-run and paste the prompts into an image tool instead.",
  );
  process.exit(1);
}

const outDir = path.join(INBOX, category);
mkdirSync(outDir, { recursive: true });
const size = category === "covers" ? "1024x1024" : "1024x1024";
for (const e of entries) {
  const out = path.join(outDir, `${e.name}.png`);
  if (existsSync(out) && !flags.force) {
    console.log(`skip ${e.name} (exists; --force to redo)`);
    continue;
  }
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: flags.model ?? "gpt-image-1",
      prompt: fullPrompt(e),
      size,
      n: 1,
    }),
  });
  if (!res.ok) {
    console.error(`${e.name}: HTTP ${res.status}`);
    process.exitCode = 1;
    continue;
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    console.error(`${e.name}: no image in the response`);
    process.exitCode = 1;
    continue;
  }
  writeFileSync(out, Buffer.from(b64, "base64"));
  console.log(`wrote ${path.relative(ROOT, out)}`);
}
