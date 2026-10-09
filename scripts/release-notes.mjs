#!/usr/bin/env node
/**
 * T9.9: release notes from conventional commit subjects since the last tag.
 *   node scripts/release-notes.mjs <bump: patch|minor|major>   → prints "vX.Y.Z" then the notes
 * Used by .github/workflows/release.yml. Pure helpers are exported for tests.
 */
import { execFileSync } from "node:child_process";

export function nextVersion(previous, bump) {
  const [major, minor, patch] = (previous || "v0.0.0").replace(/^v/, "").split(".").map(Number);
  if (bump === "major") return `v${major + 1}.0.0`;
  if (bump === "minor") return `v${major}.${minor + 1}.0`;
  return `v${major}.${minor}.${patch + 1}`;
}

const SECTIONS = [
  ["feat", "New"],
  ["fix", "Fixed"],
  ["perf", "Faster"],
  ["docs", "Docs"],
];

/** Groups "type(scope): subject" lines; merges and chores are left out. */
export function notesFrom(subjects) {
  const groups = new Map(SECTIONS.map(([type]) => [type, []]));
  const other = [];
  for (const line of subjects) {
    if (/^Merge /.test(line)) continue;
    const m = /^(\w+)(?:\(([^)]*)\))?!?: (.+)$/.exec(line);
    if (!m) {
      other.push(line);
      continue;
    }
    const [, type, scope, text] = m;
    const entry = scope ? `**${scope}:** ${text}` : text;
    if (groups.has(type)) groups.get(type).push(entry);
    else if (!["chore", "ci", "test", "refactor", "style", "build"].includes(type))
      other.push(entry);
  }
  const parts = [];
  for (const [type, title] of SECTIONS) {
    const items = groups.get(type);
    if (items.length) parts.push(`### ${title}\n\n${items.map((i) => `- ${i}`).join("\n")}`);
  }
  if (other.length) parts.push(`### Other\n\n${other.map((i) => `- ${i}`).join("\n")}`);
  return parts.join("\n\n") || "Small fixes and improvements.";
}

function git(...args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bump = process.argv[2] ?? "patch";
  let previous = "";
  try {
    previous = git("describe", "--tags", "--abbrev=0", "--match", "v*");
  } catch {
    // no tags yet
  }
  const range = previous ? `${previous}..HEAD` : "HEAD";
  const subjects = git("log", range, "--pretty=%s").split("\n").filter(Boolean);
  console.log(nextVersion(previous, bump));
  console.log(notesFrom(subjects));
}
