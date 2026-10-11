#!/usr/bin/env node
/**
 * Saves a key you just copied into a private file the setup scripts read, without
 * printing it or leaving it in your shell history (plan T14.9).
 *
 *   node scripts/save-key.mjs resend     # Resend API key (re_…)   → ~/.config/games4james/resend-api-key
 *   node scripts/save-key.mjs supabase   # Supabase access token (sbp_…) → ~/.config/games4james/supabase-access-token
 *
 * Reads the clipboard (macOS `pbpaste`), or stdin with --stdin. Checks
 * the key looks right, writes it readable only by you, then clears the clipboard.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const KINDS = {
  resend: {
    file: "resend-api-key",
    label: "Resend API key",
    pattern: /^re_[A-Za-z0-9_]{10,}$/,
    hint: "Resend keys start with re_ (resend.com → API Keys).",
  },
  supabase: {
    file: "supabase-access-token",
    label: "Supabase access token",
    pattern: /^sbp_[A-Za-z0-9_]{20,}$/,
    hint: "Supabase access tokens start with sbp_ (Account → Access tokens), not the project's sb_ API keys.",
  },
};

/** What a wrong value looks like, without showing any of it. */
function describe(text) {
  if (!text) return " (it's empty)";
  if (/^sb_(secret|publishable)_/.test(text)) return " (it looks like a Supabase project API key)";
  if (/^sbp_/.test(text)) return " (it looks like a Supabase access token)";
  if (/^re_/.test(text)) return " (it looks like a Resend key)";
  return ` (${text.length} characters)`;
}

const kind = KINDS[process.argv[2]];
if (!kind) {
  console.error(`usage: node scripts/save-key.mjs <${Object.keys(KINDS).join("|")}>`);
  process.exit(2);
}

const piped = process.argv.includes("--stdin");
let value;
try {
  value = (piped ? readFileSync(0, "utf8") : execFileSync("pbpaste", { encoding: "utf8" })).trim();
} catch {
  console.error(
    "Couldn't read the clipboard. Pipe the key in instead: <command> | node scripts/save-key.mjs <kind> --stdin",
  );
  process.exit(1);
}

if (!kind.pattern.test(value)) {
  console.error(
    `That ${piped ? "input" : "clipboard text"} isn't a ${kind.label}${describe(value)}. Nothing was saved.\n${kind.hint}\nCopy the key and run this again.`,
  );
  process.exit(1);
}

const dir = path.join(os.homedir(), ".config/games4james");
const file = path.join(dir, kind.file);
mkdirSync(dir, { recursive: true, mode: 0o700 });
writeFileSync(file, value, { mode: 0o600 });
chmodSync(file, 0o600); // also when the file already existed with looser permissions

if (!piped) {
  try {
    execFileSync("pbcopy", { input: "" });
  } catch {
    // Clearing the clipboard is a courtesy; the key is saved either way.
  }
}

const prefix = value.slice(0, value.indexOf("_") + 1);
console.log(
  `Saved the ${kind.label} (${prefix}…, ${value.length} characters) to ${file}, readable only by you.`,
);
if (!piped) console.log("Clipboard cleared.");
