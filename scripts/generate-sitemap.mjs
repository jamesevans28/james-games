/**
 * Generate sitemap.xml, robots.txt, game-meta.json and one static HTML page per
 * game (served to link-preview bots by infra/cloudfront/bot-rewrite.js).
 *
 * Brand values come from apps/player-web/src/config/brand.json; games come from
 * public/game-meta.json, written from the manifests by scripts/export-manifests.mts
 * (run that first; `npm run generate-seo -w apps/player-web` does both).
 *
 * Run: npm run generate-seo -w apps/player-web   (also runs before `vite build`)
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "apps/player-web/public");
const brandJson = JSON.parse(
  fs.readFileSync(path.join(root, "apps/player-web/src/config/brand.json"), "utf8"),
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

// Games from the exported manifests. Only `active` games are public.
const manifests = JSON.parse(
  await fs.promises.readFile(path.join(publicDir, "game-meta.json"), "utf8"),
);
if (!Array.isArray(manifests) || manifests.length === 0) {
  throw new Error("public/game-meta.json is empty: run scripts/export-manifests.mts first");
}
const publicGames = manifests
  .filter((m) => m.status === "active")
  .map((m) => ({
    id: m.id,
    title: m.title,
    description: m.seo?.description || m.description || "",
    createdAt: m.createdAt || now,
    updatedAt: m.updatedAt || m.createdAt || now,
    thumbnail: m.cover || null,
  }));
console.log(`Found ${manifests.length} games, ${publicGames.length} active`);

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
  ...["/about", "/parents", "/support"].map((page) => ({
    loc: `${domain}${page}`,
    lastmod: now,
    changefreq: "monthly",
    priority: "0.4",
  })),
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
  </url>`,
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
  const desc = game.description || brandJson.description;
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
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "AUD",
      availability: "https://schema.org/InStock",
    },
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

// games-index.html is retired (T1.9/T3.4): the home page (/) is the game listing (T7.1).
await fs.promises.rm(path.join(publicDir, "games-index.html"), { force: true });

console.log(`Generated ${publicGames.length} static game pages`);
console.log(
  `SEO generation complete: sitemap.xml (${sitemapUrls.length} URLs), robots.txt, static-games/`,
);
