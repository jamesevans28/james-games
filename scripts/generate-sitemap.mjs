/**
 * Generate sitemap.xml, robots.txt, and static SEO files for the player-web app.
 *
 * This script:
 * 1. Parses the games registry to extract all game IDs and metadata
 * 2. Generates a comprehensive sitemap.xml with game-specific metadata
 * 3. Generates robots.txt with proper directives
 * 4. Generates static HTML meta files for each game (for prerendering/SSR-like SEO)
 *
 * Run: npm run web:generate-sitemap
 * Or:  node scripts/generate-sitemap.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const gamesIndex = path.join(root, "apps/player-web/src/games/index.ts");
const seoKeywordsPath = path.join(root, "apps/player-web/src/utils/seoKeywords.ts");
const publicDir = path.join(root, "apps/player-web/public");

await fs.promises.mkdir(publicDir, { recursive: true });

const domain = process.env.SITE_ORIGIN || "https://flingo.fun";
const now = new Date().toISOString();

// Parse games registry
const src = await fs.promises.readFile(gamesIndex, "utf8");

// Extract game entries with more details
const gameEntries = [];
const gameBlocks = src.split(/\{\s*id:\s*"/);

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
  const betaOnlyMatch = block.match(/betaOnly:\s*true/);

  // Skip beta-only games from sitemap
  if (betaOnlyMatch) continue;

  gameEntries.push({
    id,
    title: titleMatch ? titleMatch[1] : id,
    description: descMatch ? descMatch[1] : "",
    createdAt: createdMatch ? createdMatch[1] : now,
    updatedAt: updatedMatch ? updatedMatch[1] : createdMatch ? createdMatch[1] : now,
    thumbnail: thumbnailMatch ? thumbnailMatch[1] : null,
  });
}

console.log(`Found ${gameEntries.length} public games`);

// Parse SEO keywords if available
let seoMeta = {};
try {
  const seoSrc = await fs.promises.readFile(seoKeywordsPath, "utf8");
  const seoMetaMatch = seoSrc.match(
    /GAME_SEO_META:\s*Record<string,\s*GameSeoMeta>\s*=\s*\{([\s\S]*?)\n\};/
  );
  if (seoMetaMatch) {
    // Simple extraction of shortDescription for each game
    const gameMetaBlocks = seoMetaMatch[1].split(/"\w+":\s*\{/);
    for (const block of gameMetaBlocks) {
      const gameIdMatch = block.match(/"([^"]+)":\s*\{/);
      const shortDescMatch = block.match(/shortDescription:\s*"([^"]+)"/);
      if (gameIdMatch && shortDescMatch) {
        seoMeta[gameIdMatch[1]] = { shortDescription: shortDescMatch[1] };
      }
    }
  }
} catch (e) {
  console.log("SEO keywords file not found, using defaults");
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
  // Games list page
  {
    loc: `${domain}/games-list`,
    lastmod: now,
    changefreq: "weekly",
    priority: "0.9",
  },
  // Individual game pages
  ...gameEntries.map((game) => ({
    loc: `${domain}/games/${game.id}`,
    lastmod: game.updatedAt || game.createdAt || now,
    changefreq: "weekly",
    priority: "0.8",
  })),
  // Leaderboard pages (lower priority, still valuable for SEO)
  ...gameEntries.map((game) => ({
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
const robots = `# robots.txt for flingo.fun
# Free online games - kid friendly, browser-based gaming

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
const gameMeta = gameEntries.map((game) => ({
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
// Generate static HTML pages for each game (for search engine crawlers)
// These serve as fallback content before JavaScript hydration
// ============================================================================
const staticGamesDir = path.join(publicDir, "static-games");
await fs.promises.mkdir(staticGamesDir, { recursive: true });

for (const game of gameEntries) {
  const seoDesc =
    seoMeta[game.id]?.shortDescription ||
    game.description ||
    "Play free online games at flingo.fun!";

  const gameHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${game.title} — Free Online Game | Play Now at flingo.fun</title>
  <meta name="description" content="${seoDesc}">
  <meta name="keywords" content="${game.title.toLowerCase()}, free online games, kid friendly games, browser games, arcade games, play free, no download games">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${domain}/games/${game.id}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="game">
  <meta property="og:title" content="${game.title} — Play Free at flingo.fun">
  <meta property="og:description" content="${seoDesc}">
  <meta property="og:url" content="${domain}/games/${game.id}">
  <meta property="og:image" content="${domain}${
    game.thumbnail || "/assets/shared/logo_square.png"
  }">
  <meta property="og:site_name" content="flingo.fun">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${game.title} — Play Free at flingo.fun">
  <meta name="twitter:description" content="${seoDesc}">
  <meta name="twitter:image" content="${domain}${
    game.thumbnail || "/assets/shared/logo_square.png"
  }">
  
  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "${game.title}",
    "description": "${seoDesc.replace(/"/g, '\\"')}",
    "url": "${domain}/games/${game.id}",
    "image": "${domain}${game.thumbnail || "/assets/shared/logo_square.png"}",
    "gamePlatform": ["Web Browser", "Mobile Browser", "PWA"],
    "applicationCategory": "Game",
    "operatingSystem": "Any",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "author": {
      "@type": "Organization",
      "name": "flingo.fun",
      "url": "${domain}"
    },
    "datePublished": "${game.createdAt}",
    "dateModified": "${game.updatedAt}",
    "isAccessibleForFree": true,
    "playMode": "SinglePlayer"
  }
  </script>
  
  <!-- Redirect to main app -->
  <meta http-equiv="refresh" content="0;url=${domain}/games/${game.id}">
</head>
<body>
  <h1>${game.title}</h1>
  <p>${seoDesc}</p>
  <p><a href="${domain}/games/${game.id}">Play ${game.title} free at flingo.fun</a></p>
  <p>Loading game...</p>
</body>
</html>`;

  await fs.promises.writeFile(path.join(staticGamesDir, `${game.id}.html`), gameHtml, "utf8");
}

console.log(`Generated ${gameEntries.length} static game pages`);

// ============================================================================
// Generate games-index.html for listing all games (SEO landing page)
// ============================================================================
const gamesListHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>All Free Online Games | Play Kid-Friendly Games at flingo.fun</title>
  <meta name="description" content="Browse all free online games at flingo.fun! Kid-friendly arcade, puzzle, word, and skill games. No download required - play instantly in your browser.">
  <meta name="keywords" content="free online games, kid friendly games, browser games, arcade games, puzzle games, word games, skill games, no download games, instant play">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${domain}/">
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="All Free Online Games | flingo.fun">
  <meta property="og:description" content="Browse all free games at flingo.fun! Kid-friendly games for all ages.">
  <meta property="og:url" content="${domain}/">
  <meta property="og:image" content="${domain}/assets/shared/logo_square.png">
  
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #7c3aed; }
    .game-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
    .game-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; }
    .game-card h2 { font-size: 1.1rem; margin: 0 0 8px; }
    .game-card p { font-size: 0.9rem; color: #6b7280; margin: 0 0 10px; }
    .game-card a { color: #7c3aed; text-decoration: none; font-weight: 600; }
  </style>
  
  <!-- JSON-LD ItemList -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Free Online Games at flingo.fun",
    "description": "Collection of free, kid-friendly browser games",
    "numberOfItems": ${gameEntries.length},
    "itemListElement": [
      ${gameEntries
        .map(
          (game, i) => `{
        "@type": "ListItem",
        "position": ${i + 1},
        "item": {
          "@type": "VideoGame",
          "name": "${game.title}",
          "url": "${domain}/games/${game.id}"
        }
      }`
        )
        .join(",\n      ")}
    ]
  }
  </script>
  
  <meta http-equiv="refresh" content="0;url=${domain}/">
</head>
<body>
  <h1>Free Online Games at flingo.fun</h1>
  <p>Play free, kid-friendly games instantly in your browser. No download required!</p>
  
  <div class="game-list">
    ${gameEntries
      .map(
        (game) => `
    <div class="game-card">
      <h2>${game.title}</h2>
      <p>${(seoMeta[game.id]?.shortDescription || game.description || "").slice(0, 100)}...</p>
      <a href="${domain}/games/${game.id}">Play Now →</a>
    </div>
    `
      )
      .join("")}
  </div>
  
  <p>Loading flingo.fun...</p>
</body>
</html>`;

await fs.promises.writeFile(path.join(publicDir, "games-index.html"), gamesListHtml, "utf8");
console.log("Generated games-index.html");

console.log("\n✅ SEO generation complete!");
console.log(`   - sitemap.xml: ${sitemapUrls.length} URLs`);
console.log(`   - robots.txt: Updated`);
console.log(`   - game-meta.json: ${gameEntries.length} games`);
console.log(`   - static-games/: ${gameEntries.length} HTML pages`);
console.log(`   - games-index.html: Game listing page`);
