// Generate a basic sitemap.xml and robots.txt based on the games registry
// Heuristic parse of src/games/index.ts to find ids. Assumes consistent formatting.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const gamesIndex = path.join(root, "src/games/index.ts");
const publicDir = path.join(root, "public");
await fs.promises.mkdir(publicDir, { recursive: true });

const domain = process.env.SITE_ORIGIN || "https://games4james.com";
const now = new Date().toISOString();

const src = await fs.promises.readFile(gamesIndex, "utf8");
const ids = Array.from(src.matchAll(/id:\s*"([^"]+)"/g)).map((m) => m[1]);

const urls = [`${domain}/`, ...ids.map((id) => `${domain}/games/${id}`)];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>${
        u.endsWith("/") ? "1.0" : "0.8"
      }</priority></url>`
  )
  .join("\n")}
</urlset>`;

await fs.promises.writeFile(path.join(publicDir, "sitemap.xml"), sitemap, "utf8");

const robots = `User-agent: *\nAllow: /\n\nSitemap: ${domain}/sitemap.xml\n`;
await fs.promises.writeFile(path.join(publicDir, "robots.txt"), robots, "utf8");

console.log("Generated sitemap.xml and robots.txt for", urls.length, "routes");
