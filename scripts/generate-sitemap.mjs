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
const toGame = (m) => ({
  id: m.id,
  title: m.title,
  tagline: m.tagline || "",
  description: m.seo?.description || m.description || "",
  objective: m.objective || "",
  controls: m.controls || "",
  note: m.note || "",
  noteBy: m.noteBy || "",
  category: m.seo?.category || "casual",
  keyphrase: m.seo?.keyphrase || "",
  createdAt: m.createdAt || now,
  updatedAt: m.updatedAt || m.createdAt || now,
  thumbnail: m.cover || null,
});
const publicGames = manifests.filter((m) => m.status === "active").map(toGame);
// Beta and inactive games still answer at /games/:id, so crawlers get a noindex page.
const hiddenGames = manifests.filter((m) => m.status !== "active").map(toGame);
console.log(`Found ${manifests.length} games, ${publicGames.length} active`);

// ============================================================================
// Generate sitemap.xml
// ============================================================================
// Only indexable pages (leaderboards and profiles are noindex). No changefreq or
// priority: Google ignores both. lastmod only where it is true: a game's comes from
// its manifest's updatedAt, so bump that when the game or its cover changes. The
// home and info pages have none (a build date on every deploy teaches Google to
// ignore lastmod altogether).
const sitemapUrls = [
  { loc: `${domain}/` },
  ...["/about", "/parents", "/support", "/privacy"].map((page) => ({ loc: `${domain}${page}` })),
  ...publicGames.map((game) => ({
    loc: `${domain}/games/${game.id}`,
    lastmod: game.updatedAt,
    image: game.thumbnail ? `${domain}${game.thumbnail}` : null,
  })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapUrls
  .map((u) =>
    [
      "  <url>",
      `    <loc>${u.loc}</loc>`,
      u.lastmod && `    <lastmod>${u.lastmod}</lastmod>`,
      u.image && `    <image:image><image:loc>${u.image}</image:loc></image:image>`,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n"),
  )
  .join("\n")}
</urlset>
`;

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

// Social previews need a raster image. A processed cover (cover.png from
// scripts/art/cover.mjs) has a 1200×630 og.png beside it; SVG thumbnails fall
// back to the brand card.
const previewImage = (thumbnail) => {
  if (thumbnail && /\/cover\.png$/.test(thumbnail))
    return `${domain}${thumbnail.replace(/\/cover\.png$/, "/og.png")}`;
  return `${domain}${thumbnail && /\.(png|jpe?g|webp)$/i.test(thumbnail) ? thumbnail : brandJson.ogImage}`;
};

// Same format as gameSeoTitle() in src/utils/seoKeywords.ts.
const seoTitle = (game) =>
  game.keyphrase
    ? `${game.title}: free ${game.keyphrase} for kids | ${brandJson.name}`
    : `${game.title} | ${brandJson.name}`;
// Tiles and pages show the WebP beside cover.png (displayCover() in src/games/index.ts).
const displayCover = (cover) => cover.replace(/\/cover\.png$/, "/cover.webp");
const GENRES = {
  reflex: "Reflex",
  puzzle: "Puzzle",
  word: "Word",
  arcade: "Arcade",
  sports: "Sports",
  memory: "Memory",
  action: "Action",
  casual: "Casual",
  strategy: "Strategy",
};

// Up to four other games, the same kind first, so every page links onwards.
const relatedTo = (game) =>
  [
    ...publicGames.filter((g) => g.id !== game.id && g.category === game.category),
    ...publicGames.filter((g) => g.id !== game.id && g.category !== game.category),
  ].slice(0, 4);

const siteLinks = `<nav>
    <a href="${domain}/">All games</a> ·
    <a href="${domain}/about">About us</a> ·
    <a href="${domain}/parents">For grown-ups</a> ·
    <a href="${domain}/privacy">Privacy</a>
  </nav>`;

const staticPage = ({ id, title, desc, url, image, robots, jsonLd, body }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${url}">
  <link rel="icon" type="image/svg+xml" href="${brandJson.logoMark}">
  <meta name="theme-color" content="${brandJson.themeColor}">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(brandJson.name)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:alt" content="${escapeHtml(title)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(desc)}">
  <meta name="twitter:image" content="${image}">
${
  jsonLd
    ? `
  <script type="application/ld+json">
${jsonForScript(jsonLd)}
  </script>`
    : ""
}
  <script>
    // Humans who open this file directly go to the app. Bots served this page
    // at /games/:id stay here (the path check stops a redirect loop).
    if (location.pathname.indexOf("/static-games/") === 0) location.replace("/games/${id}");
  </script>
</head>
<body>
${body}
</body>
</html>
`;

for (const game of publicGames) {
  const url = `${domain}/games/${game.id}`;
  const desc = game.description || brandJson.description;
  const title = seoTitle(game);
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
    genre: GENRES[game.category] || "Casual",
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
    inLanguage: "en",
    isAccessibleForFree: true,
    playMode: "SinglePlayer",
  };
  const related = relatedTo(game)
    .map(
      (g) =>
        `      <li><a href="${domain}/games/${g.id}">${escapeHtml(g.title)}</a>: ${escapeHtml(g.tagline)}</li>`,
    )
    .join("\n");
  const cover = game.thumbnail
    ? `\n    <img src="${domain}${displayCover(game.thumbnail)}" alt="${escapeHtml(`${game.title} game cover`)}" width="512" height="512">`
    : "";

  const body = `  ${siteLinks}
  <main>
    <h1>${escapeHtml(game.title)}</h1>
    <p><strong>${escapeHtml(game.tagline)}</strong></p>${cover}
    <p>${escapeHtml(desc)}</p>
    <p><a href="${url}">Play ${escapeHtml(game.title)} now</a>. It's free, with no ads and nothing to download: it runs in the web browser on phones, tablets and computers.</p>
${
  game.objective || game.controls
    ? `
    <h2>How to play</h2>
    ${game.objective ? `<p>${escapeHtml(game.objective)}</p>` : ""}
    ${game.controls ? `<p>${escapeHtml(game.controls)}</p>` : ""}
`
    : ""
}${
    game.note
      ? `
    <h2>${escapeHtml(game.noteBy ? `${game.noteBy}'s note` : "Designer's note")}</h2>
    <p>${escapeHtml(game.note)}</p>
`
      : ""
  }
    <p>Made by ${escapeHtml(makersLine(brandJson.makers))}, a dad and his kids who make little games together.</p>

    <h2>More games to try</h2>
    <ul>
${related}
    </ul>
  </main>`;

  await fs.promises.writeFile(
    path.join(staticGamesDir, `${game.id}.html`),
    staticPage({ id: game.id, title, desc, url, image, robots: "index, follow", jsonLd, body }),
    "utf8",
  );
}

// Beta and resting games: a short page that keeps them out of search results.
for (const game of hiddenGames) {
  const url = `${domain}/games/${game.id}`;
  const body = `  ${siteLinks}
  <main>
    <h1>${escapeHtml(game.title)} is having a rest</h1>
    <p><a href="${domain}/">See all the games on ${escapeHtml(brandJson.name)}</a>.</p>
  </main>`;
  await fs.promises.writeFile(
    path.join(staticGamesDir, `${game.id}.html`),
    staticPage({
      id: game.id,
      title: `${game.title} | ${brandJson.name}`,
      desc: brandJson.description,
      url,
      image: `${domain}${brandJson.ogImage}`,
      robots: "noindex, follow",
      jsonLd: null,
      body,
    }),
    "utf8",
  );
}

// games-index.html is retired (T1.9/T3.4): the home page (/) is the game listing (T7.1).
await fs.promises.rm(path.join(publicDir, "games-index.html"), { force: true });

console.log(
  `Generated ${publicGames.length} static game pages and ${hiddenGames.length} noindex ones`,
);
console.log(
  `SEO generation complete: sitemap.xml (${sitemapUrls.length} URLs), robots.txt, static-games/`,
);
