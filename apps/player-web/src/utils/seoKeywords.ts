/**
 * SEO metadata for the site and each game: descriptions, categories and JSON-LD
 * builders. (Meta keywords were dropped in T3.4; search engines ignore them.)
 * scripts/generate-sitemap.mjs regex-reads GAME_SEO_META, so keep its shape.
 */

import { brand, makersLine } from "../config/brand";

export const SITE_NAME = brand.name;
export const SITE_URL = brand.origin;
export const SITE_TAGLINE = brand.tagline;

// Game categories (drive the JSON-LD genre)
export type GameCategory =
  "reflex" | "puzzle" | "word" | "arcade" | "sports" | "memory" | "action" | "casual" | "strategy";

// Per-game SEO metadata
export type GameSeoMeta = {
  category: GameCategory;
  ageRating: "everyone" | "kids" | "teens";
  shortDescription: string; // Under 160 chars for meta description
  longDescription?: string; // For JSON-LD
};

export const GAME_SEO_META: Record<string, GameSeoMeta> = {
  "word-stack": {
    category: "word",
    ageRating: "everyone",
    shortDescription:
      "Start with one 5-letter word, then swap in letters to make new ones. Free word puzzle, no ads.",
  },
  "reflex-ring": {
    category: "reflex",
    ageRating: "everyone",
    shortDescription:
      "Tap when the arrow hits the bright segment. It speeds up every round. Free, no ads.",
  },
  snapadile: {
    category: "reflex",
    ageRating: "kids",
    shortDescription:
      "Crocs are swimming for your raft! Tap them before they snap. Free, no ads, and great for small fingers.",
  },
  "car-crash": {
    category: "arcade",
    ageRating: "everyone",
    shortDescription:
      "Switch lanes and dodge the traffic. How far can you drive? A free little arcade game, no ads.",
  },
  "fill-the-cup": {
    category: "casual",
    ageRating: "everyone",
    shortDescription:
      "Hold to pour, let go to stop. Fill each glass to the line without spilling. Free, no ads.",
  },
  "flash-bash": {
    category: "memory",
    ageRating: "kids",
    shortDescription:
      "Watch the lights, then copy the pattern. How long a sequence can you remember? Free memory game, no ads.",
  },
  "ho-ho-home-delivery": {
    category: "arcade",
    ageRating: "kids",
    shortDescription: "Help Santa drop presents down the chimneys. A free Christmas game, no ads.",
  },
  "ready-steady-shoot": {
    category: "sports",
    ageRating: "everyone",
    shortDescription:
      "Aim, pick your power and shoot for the hoop. A free basketball game, no ads.",
  },
  "paddle-pop": {
    category: "arcade",
    ageRating: "everyone",
    shortDescription:
      "Bounce the ball, hit the targets, grab the power-ups. A free paddle game, no ads.",
  },
  "word-rush": {
    category: "word",
    ageRating: "everyone",
    shortDescription:
      "Pick your letters, then guess the hidden words before the clock runs out. Free word game, no ads.",
  },
  serpento: {
    category: "arcade",
    ageRating: "everyone",
    shortDescription:
      "Eat to grow, don't hit the walls (or yourself). Our take on the classic snake game. Free, no ads.",
  },
  blocker: {
    category: "puzzle",
    ageRating: "everyone",
    shortDescription:
      "Drop blocks, clear lines, chain combos. Easy to start, hard to stop. Free puzzle game, no ads.",
  },
  "hoop-city": {
    category: "arcade",
    ageRating: "everyone",
    shortDescription:
      "Tap to float the ball through hoops as the city scrolls past. Free, no ads, one more go guaranteed.",
  },
  "cosmic-clash": {
    category: "action",
    ageRating: "everyone",
    shortDescription:
      "Blast the space invaders, grab power-ups and survive the waves. Free shooter, no ads.",
  },
  "block-breaker": {
    category: "arcade",
    ageRating: "everyone",
    shortDescription:
      "Smash every brick with your ball. The classic brick breaker, free and with no ads.",
  },
  "box-cutter": {
    category: "arcade",
    ageRating: "everyone",
    shortDescription:
      "Draw lines to box off the board while dodging the fireball. Free, no ads, very satisfying.",
  },
};

/**
 * Absolute share image for a page. Social previews need a raster image, so SVG
 * thumbnails fall back to the brand share card.
 */
export function shareImageFor(thumbnail?: string | null): string {
  return `${SITE_URL}${thumbnail && /\.(png|jpe?g|webp)$/i.test(thumbnail) ? thumbnail : brand.ogImage}`;
}

/**
 * Get game description optimized for SEO (under 160 chars)
 */
export function getGameSeoDescription(gameId: string, fallback?: string): string {
  const meta = GAME_SEO_META[gameId];
  if (meta?.shortDescription) {
    return meta.shortDescription;
  }
  if (fallback) {
    // Truncate fallback to 155 chars + ellipsis if needed
    return fallback.length > 155 ? fallback.slice(0, 155) + "..." : fallback;
  }
  return brand.description;
}

/**
 * Build JSON-LD structured data for a game
 */
export function buildGameJsonLd(game: {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  createdAt?: string;
  updatedAt?: string;
}): Record<string, unknown> {
  const meta = GAME_SEO_META[game.id];
  const category = meta?.category || "casual";
  const ageRating = meta?.ageRating || "everyone";

  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: meta?.shortDescription || game.description || "",
    url: `${SITE_URL}/games/${game.id}`,
    image: shareImageFor(game.thumbnail),
    gamePlatform: ["Web Browser", "Mobile Browser", "PWA"],
    applicationCategory: "Game",
    genre: getCategoryGenre(category),
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "AUD",
      availability: "https://schema.org/InStock",
    },
    author: brand.makers.map((name) => ({ "@type": "Person", name })),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    datePublished: game.createdAt,
    dateModified: game.updatedAt || game.createdAt,
    contentRating: getContentRating(ageRating),
    inLanguage: "en",
    isAccessibleForFree: true,
    playMode: "SinglePlayer",
    numberOfPlayers: {
      "@type": "QuantitativeValue",
      minValue: 1,
      maxValue: 1,
    },
  };
}

function getCategoryGenre(category: GameCategory): string[] {
  const genreMap: Record<GameCategory, string[]> = {
    reflex: ["Arcade", "Action"],
    puzzle: ["Puzzle", "Brain Game"],
    word: ["Word Game", "Puzzle", "Educational"],
    arcade: ["Arcade", "Action"],
    sports: ["Sports", "Arcade"],
    memory: ["Puzzle", "Brain Game", "Educational"],
    action: ["Action", "Arcade", "Shooter"],
    casual: ["Casual", "Arcade"],
    strategy: ["Strategy", "Puzzle"],
  };
  return genreMap[category] || ["Casual"];
}

function getContentRating(ageRating: "everyone" | "kids" | "teens"): string {
  const ratingMap = {
    everyone: "ESRB Everyone",
    kids: "ESRB Everyone",
    teens: "ESRB Everyone 10+",
  };
  return ratingMap[ageRating];
}

/**
 * Build JSON-LD for the game collection (homepage)
 */
export function buildGameCollectionJsonLd(
  games: Array<{ id: string; title: string; thumbnail?: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Games on ${brand.name}`,
    description: `Little games made by ${makersLine()}. Free, no ads, no download.`,
    numberOfItems: games.length,
    itemListElement: games.slice(0, 20).map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "VideoGame",
        name: game.title,
        url: `${SITE_URL}/games/${game.id}`,
        image: shareImageFor(game.thumbnail),
      },
    })),
  };
}

/**
 * Build the website's main JSON-LD with search action
 */
export function buildWebsiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: brand.description,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: { "@type": "ImageObject", url: `${SITE_URL}${brand.logoSquare}` },
    },
  };
}

/**
 * Build Organization JSON-LD
 */
export function buildOrganizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}${brand.logoSquare}`,
    founder: brand.makers.map((name) => ({ "@type": "Person", name })),
  };
}
