#!/usr/bin/env node
/**
 * T8.2: one prompt source for both workflows.
 *   node scripts/art/generate.mjs --dry-run covers            print the prompts (Option A: paste them by hand)
 *   node scripts/art/generate.mjs covers [--only snapadile]   call the image API (Option B, costs money)
 *     --ref <image>    match the style of this image (the Snapadile cover is the anchor); uses /v1/images/edits
 *     --variants <n>   make n versions per prompt: art-inbox/<category>/<name>-1.png … (default 1: <name>.png)
 *     --quality <q>    low | medium | high (default medium)
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
const size = "1024x1024";
const variants = Math.max(1, Number(flags.variants ?? 1));
const quality = String(flags.quality ?? "medium");
const ref = flags.ref ? path.resolve(String(flags.ref)) : null;
if (ref && !existsSync(ref)) {
  console.error(`--ref ${flags.ref}: file not found`);
  process.exit(2);
}
const STYLE_FROM_REF =
  "Draw a NEW picture in exactly the same style as the attached reference image: the same crayon texture, the same thick wobbly black outlines, the same cream paper and the same colours. Do not copy the reference's subject or layout. The new picture: ";

/** Reports the API's own error message (it never contains the key). */
async function failure(name, res) {
  let msg = "";
  try {
    msg = (await res.json())?.error?.message ?? "";
  } catch {
    // Not JSON: the status is enough.
  }
  console.error(`${name}: HTTP ${res.status}${msg ? ` - ${msg}` : ""}`);
  process.exitCode = 1;
}

async function generate(prompt) {
  const model = String(flags.model ?? "gpt-image-2");
  const headers = { authorization: `Bearer ${key}` };
  if (!ref) {
    return fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
    });
  }
  const form = new FormData();
  const type = ref.endsWith(".webp")
    ? "image/webp"
    : ref.endsWith(".jpg") || ref.endsWith(".jpeg")
      ? "image/jpeg"
      : "image/png";
  form.append("image[]", new Blob([readFileSync(ref)], { type }), path.basename(ref));
  form.append("model", model);
  form.append("prompt", STYLE_FROM_REF + prompt);
  form.append("size", size);
  form.append("quality", quality);
  form.append("n", "1");
  return fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers, body: form });
}

for (const e of entries) {
  for (let v = 1; v <= variants; v++) {
    const file = variants === 1 ? `${e.name}.png` : `${e.name}-${v}.png`;
    const out = path.join(outDir, file);
    if (existsSync(out) && !flags.force) {
      console.log(`skip ${file} (exists; --force to redo)`);
      continue;
    }
    const res = await generate(fullPrompt(e));
    if (!res.ok) {
      await failure(file, res);
      if (res.status === 401 || res.status === 403) process.exit(1);
      continue;
    }
    const json = await res.json();
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      console.error(`${file}: no image in the response`);
      process.exitCode = 1;
      continue;
    }
    writeFileSync(out, Buffer.from(b64, "base64"));
    console.log(`wrote ${path.relative(ROOT, out)}`);
  }
}
