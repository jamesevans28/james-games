/**
 * SEO metadata for the site and each game: descriptions, categories and JSON-LD
 * builders. (Meta keywords were dropped in T3.4; search engines ignore them.)
 * Per-game SEO text and category live in each game's manifest (T4.8).
 */

import { brand, makersLine } from "../config/brand";
import { getManifest } from "../platform/registry";
import type { GameCategory } from "../platform/sdk";

export const SITE_NAME = brand.name;
export const SITE_URL = brand.origin;
export const SITE_TAGLINE = brand.tagline;

// Game categories (drive the JSON-LD genre)
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
  const seo = getManifest(gameId)?.seo.description;
  if (seo) return seo;
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
  const seo = getManifest(game.id)?.seo;
  const category: GameCategory = seo?.category ?? "casual";

  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.title,
    description: seo?.description || game.description || "",
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
