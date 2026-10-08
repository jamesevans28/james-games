/**
 * Generate sitemap.xml, robots.txt, game-meta.json and one static HTML page per
 * game (served to link-preview bots by infra/cloudfront/bot-rewrite.js).
 *
 * Brand values come from apps/player-web/src/config/brand.json. Game metadata is
 * regex-parsed from the registry until Phase 4 gives every game a manifest.
 *
 * Run: npm run generate-seo -w apps/player-web   (also runs before `vite build`)
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const gamesIndex = path.join(root, "apps/player-web/src/games/index.ts");
const seoKeywordsPath = path.join(root, "apps/player-web/src/utils/seoKeywords.ts");
const publicDir = path.join(root, "apps/player-web/public");
const brandJson = JSON.parse(
  fs.readFileSync(path.join(root, "apps/player-web/src/config/brand.json"), "utf8")
);

await fs.promises.mkdir(publicDir, { recursive: true });

const domain = (process.env.SITE_ORIGIN || brandJson.origin).replace(/\/$/, "");
const now = new Date().toISOString();

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
// JSON inside <script> must not be able to close the tag.
const jsonForScript = (data) => JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
const makersLine = (makers) =>
  makers.length <= 1 ? makers.join("") : `${makers.slice(0, -1).join(", ")} & ${makers.at(-1)}`;

// Parse games registry
const src = await fs.promises.readFile(gamesIndex, "utf8");

const gameEntries = [];
const gameBlocks = src.split(/\{\s*id:\s*"/);
const registryCount = (src.match(/^\s*load:\s*async/gm) || []).length;

for (let i = 1; i < gameBlocks.length; i++) {
  const block = gameBlocks[i];
  const idMatch = block.match(/^([^"]+)"/);
  if (!idMatch) continue;

  const id = idMatch[1];
  const titleMatch = block.match(/title:\s*"([^"]+)"/);
  const descMatch = block.match(/description:\s*"([^"]+)"/);
  const createdMatch = block.match(/createdAt:\s*"([^"]+)"/);
  const updatedMatch = block.match(/updatedAt:\s*"([^"]+)"/);
  const thumbnailMatch = block.match(/thumbnail:\s*"([^"]+)"/);
  const hidden = /betaOnly:\s*true/.test(block) || /status:\s*"inactive"/.test(block);

  gameEntries.push({
    id,
    hidden,
    title: titleMatch ? titleMatch[1] : id,
    description: descMatch ? descMatch[1] : "",
    createdAt: createdMatch ? createdMatch[1] : now,
    updatedAt: updatedMatch ? updatedMatch[1] : createdMatch ? createdMatch[1] : now,
    thumbnail: thumbnailMatch ? thumbnailMatch[1] : null,
  });
}

// The regex parse is fragile: fail loudly if it missed a registry entry.
if (gameEntries.length === 0 || gameEntries.length !== registryCount) {
  throw new Error(
    `Parsed ${gameEntries.length} games but the registry has ${registryCount} load() entries`
  );
}
const publicGames = gameEntries.filter((g) => !g.hidden);
console.log(`Found ${gameEntries.length} games, ${publicGames.length} public`);

// Per-game SEO descriptions from GAME_SEO_META in seoKeywords.ts.
const seoMeta = {};
{
  const seoSrc = await fs.promises.readFile(seoKeywordsPath, "utf8");
  const block = seoSrc.match(/GAME_SEO_META:\s*Record<string,\s*GameSeoMeta>\s*=\s*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error("GAME_SEO_META not found in seoKeywords.ts");
  // Keys are either quoted ("word-stack") or bare (snapadile).
  const entry = /^ {2}(?:"([a-z0-9-]+)"|([a-z0-9]+)): \{[\s\S]*?shortDescription:\s*"([^"]+)"/gm;
  for (const m of block[1].matchAll(entry)) {
    seoMeta[m[1] ?? m[2]] = { shortDescription: m[3] };
  }
  const missing = publicGames.filter((g) => !seoMeta[g.id]).map((g) => g.id);
  if (missing.length) console.warn(`No GAME_SEO_META shortDescription for: ${missing.join(", ")}`);
}

// ============================================================================
// Generate sitemap.xml
// ============================================================================
const sitemapUrls = [
  // Homepage - highest priority
  {
    loc: `${domain}/`,
    lastmod: now,
    changefreq: "daily",
    priority: "1.0",
  },
  {
    loc: `${domain}/privacy`,
    lastmod: now,
    changefreq: "monthly",
    priority: "0.3",
  },
  // Games list page
  {
    loc: `${domain}/games-list`,
    lastmod: now,
    changefreq: "weekly",
    priority: "0.9",
  },
  // Individual game pages
  ...publicGames.map((game) => ({
    loc: `${domain}/games/${game.id}`,
    lastmod: game.updatedAt || game.createdAt || now,
    changefreq: "weekly",
    priority: "0.8",
  })),
  // Leaderboard pages (lower priority, still valuable for SEO)
  ...publicGames.map((game) => ({
    loc: `${domain}/leaderboard/${game.id}`,
    lastmod: now,
    changefreq: "daily",
    priority: "0.6",
  })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

await fs.promises.writeFile(path.join(publicDir, "sitemap.xml"), sitemap, "utf8");
console.log(`Generated sitemap.xml with ${sitemapUrls.length} URLs`);

// ============================================================================
// Generate robots.txt
// ============================================================================
const robots = `# robots.txt for ${brandJson.name} (${domain})

User-agent: *
Allow: /

# Block admin/settings pages from indexing
Disallow: /settings
Disallow: /notifications
Disallow: /followers
Disallow: /login
Disallow: /signup

# Sitemap location
Sitemap: ${domain}/sitemap.xml

# Crawl-delay for polite crawling
Crawl-delay: 1
`;

await fs.promises.writeFile(path.join(publicDir, "robots.txt"), robots, "utf8");
console.log("Generated robots.txt");

// ============================================================================
// Generate game-meta.json for runtime SEO enhancement
// ============================================================================
const gameMeta = publicGames.map((game) => ({
  id: game.id,
  title: game.title,
  description: seoMeta[game.id]?.shortDescription || game.description,
  thumbnail: game.thumbnail,
  url: `${domain}/games/${game.id}`,
  createdAt: game.createdAt,
  updatedAt: game.updatedAt,
}));

await fs.promises.writeFile(
  path.join(publicDir, "game-meta.json"),
  JSON.stringify(gameMeta, null, 2),
  "utf8"
);
console.log("Generated game-meta.json");

// ============================================================================
// Static HTML page per game, for link-preview bots and crawlers.
// infra/cloudfront/bot-rewrite.js serves /games/:id from these for bot user
// agents; humans who land on /static-games/:id.html are sent to the app.
// ============================================================================
const staticGamesDir = path.join(publicDir, "static-games");
await fs.promises.rm(staticGamesDir, { recursive: true, force: true });
await fs.promises.mkdir(staticGamesDir, { recursive: true });

// Social previews need a raster image; SVG thumbnails fall back to the brand card.
const previewImage = (thumbnail) =>
  `${domain}${thumbnail && /\.(png|jpe?g|webp)$/i.test(thumbnail) ? thumbnail : brandJson.ogImage}`;

for (const game of publicGames) {
  const url = `${domain}/games/${game.id}`;
  const desc = seoMeta[game.id]?.shortDescription || game.description || brandJson.description;
  const title = `${game.title} | ${brandJson.name}`;
  const image = previewImage(game.thumbnail);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: desc,
    url,
    image,
    gamePlatform: ["Web Browser", "Mobile Browser", "PWA"],
    applicationCategory: "Game",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "AUD", availability: "https://schema.org/InStock" },
    author: brandJson.makers.map((name) => ({ "@type": "Person", name })),
    publisher: { "@type": "Organization", name: brandJson.name, url: `${domain}/` },
    datePublished: game.createdAt,
    dateModified: game.updatedAt,
    isAccessibleForFree: true,
    playMode: "SinglePlayer",
  };

  const gameHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/svg+xml" href="${brandJson.logoMark}">
  <meta name="theme-color" content="${brandJson.themeColor}">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(brandJson.name)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:alt" content="${escapeHtml(game.title)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(desc)}">
  <meta name="twitter:image" content="${image}">

  <script type="application/ld+json">
${jsonForScript(jsonLd)}
  </script>
  <script>
    // Humans who open this file directly go to the app. Bots served this page
    // at /games/:id stay here (the path check stops a redirect loop).
    if (location.pathname.indexOf("/static-games/") === 0) location.replace("/games/${game.id}");
  </script>
</head>
<body>
  <h1>${escapeHtml(game.title)}</h1>
  <p>${escapeHtml(desc)}</p>
  <p>Made by ${escapeHtml(makersLine(brandJson.makers))}.</p>
  <p><a href="${url}">Play ${escapeHtml(game.title)} on ${escapeHtml(brandJson.name)}</a></p>
</body>
</html>
`;

  await fs.promises.writeFile(path.join(staticGamesDir, `${game.id}.html`), gameHtml, "utf8");
}

// games-index.html is retired (T1.9/T3.4): the SPA's /games-list is the listing page.
await fs.promises.rm(path.join(publicDir, "games-index.html"), { force: true });

console.log(`Generated ${publicGames.length} static game pages`);
console.log(`SEO generation complete: sitemap.xml (${sitemapUrls.length} URLs), robots.txt, game-meta.json, static-games/`);
