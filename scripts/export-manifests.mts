/**
 * Writes every game manifest to apps/player-web/public/game-meta.json (T4.8), so
 * Node scripts (the sitemap and static pages, later the backend's score limits)
 * read real data instead of regex-parsing TypeScript.
 *
 * Run: npx tsx scripts/export-manifests.mts   (part of `npm run generate-seo -w apps/player-web`)
 */
import { readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { GameManifest } from "../apps/player-web/src/platform/sdk";
import { checkManifest } from "../apps/player-web/src/platform/manifestSchema";

const gamesDir = path.resolve(import.meta.dirname, "../apps/player-web/src/games");
const out = path.resolve(import.meta.dirname, "../apps/player-web/public/game-meta.json");

const manifests: GameManifest[] = [];
for (const id of readdirSync(gamesDir).sort()) {
  const file = path.join(gamesDir, id, "manifest.ts");
  if (!existsSync(file)) continue;
  const mod = (await import(pathToFileURL(file).href)) as { default: GameManifest };
  const issues = checkManifest(mod.default);
  if (issues.length) {
    throw new Error(
      `${id}/manifest.ts is invalid: ${issues.map((i) => `${i.path} ${i.message}`).join("; ")}`,
    );
  }
  manifests.push(mod.default);
}

manifests.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
writeFileSync(out, `${JSON.stringify(manifests, null, 2)}\n`);
console.log(`Exported ${manifests.length} manifests to ${path.relative(process.cwd(), out)}`);
