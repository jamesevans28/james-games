#!/usr/bin/env node
/**
 * T8.3: every active or beta game has a 1024×1024 cover.png and a 1200×630 og.png,
 * and its manifest points at the cover. Exit 1 with a list otherwise.
 *   node scripts/art/check.mjs            (CI runs this from T8.4 on)
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PUBLIC } from "./lib.mjs";

const manifests = JSON.parse(readFileSync(path.join(PUBLIC, "game-meta.json"), "utf8"));
const problems = [];
for (const m of manifests.filter((x) => x.status !== "inactive")) {
  const want = [
    [`/assets/${m.id}/cover.png`, 1024, 1024],
    [`/assets/${m.id}/og.png`, 1200, 630],
  ];
  for (const [rel, w, h] of want) {
    const file = path.join(PUBLIC, rel);
    if (!existsSync(file)) {
      problems.push(`${m.id}: missing ${rel}`);
      continue;
    }
    const meta = await sharp(file).metadata();
    if (meta.width !== w || meta.height !== h)
      problems.push(`${m.id}: ${rel} is ${meta.width}×${meta.height}, want ${w}×${h}`);
  }
  if (m.cover !== `/assets/${m.id}/cover.png`)
    problems.push(`${m.id}: manifest cover is ${m.cover}`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("Art check passed.");
