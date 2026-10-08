/**
 * SEO Keywords and Categories for Games
 *
 * Central configuration for SEO metadata across all games.
 * These keywords are optimized for discoverability of free, kid-friendly,
 * browser-based games.
 */

import { brand, makersLine } from "../config/brand";

export const SITE_NAME = brand.name;
export const SITE_URL = brand.origin;
export const SITE_TAGLINE = brand.tagline;

// Core site-level keywords (used globally)
export const SITE_KEYWORDS = [
  "free online games",
  "free games",
  "play free games",
  "browser games",
  "no download games",
  "instant play games",
  "mobile games",
  "kid friendly games",
  "family friendly games",
  "arcade games",
  "skill games",
  "casual games",
  "HTML5 games",
  "PWA games",
  "touch games",
  "phone games",
  "tablet games",
];

// Game category definitions with associated keywords
export type GameCategory =
  | "reflex"
  | "puzzle"
  | "word"
  | "arcade"
  | "sports"
  | "memory"
  | "action"
  | "casual"
  | "strategy";

export const CATEGORY_KEYWORDS: Record<GameCategory, string[]> = {
  reflex: [
    "reflex games",
    "reaction games",
    "timing games",
    "fast games",
    "quick reaction games",
    "tap games",
  ],
  puzzle: [
    "puzzle games",
    "brain games",
    "thinking games",
    "logic games",
    "mind games",
    "block puzzle",
  ],
  word: [
    "word games",
    "word puzzle",
    "spelling games",
    "vocabulary games",
    "letter games",
    "anagram games",
  ],
  arcade: [
    "arcade games",
    "classic arcade",
    "retro games",
    "endless games",
    "high score games",
    "coin-op style games",
  ],
  sports: ["sports games", "basketball games", "ball games", "shooting games", "aim games"],
  memory: ["memory games", "pattern games", "sequence games", "simon says games", "brain training"],
  action: ["action games", "shooting games", "space shooter", "dodge games", "survival games"],
  casual: [
    "casual games",
    "simple games",
    "easy games",
    "relaxing games",
    "quick games",
    "one tap games",
  ],
  strategy: ["strategy games", "planning games", "tactics games", "thinking games"],
};

// Per-game SEO metadata
export type GameSeoMeta = {
  keywords: string[];
  category: GameCategory;
  ageRating: "everyone" | "kids" | "teens";
  shortDescription: string; // Under 160 chars for meta description
  longDescription?: string; // For JSON-LD
};

export const GAME_SEO_META: Record<string, GameSeoMeta> = {
  "word-stack": {
    category: "word",
    ageRating: "everyone",
    keywords: [
      "word stack game",
      "5 letter word game",
      "word building game",
      "free word game",
      "drag letter game",
      "vocabulary game online",
    ],
    shortDescription:
      "Start with one 5-letter word, then swap in letters to make new ones. Free word puzzle, no ads.",
  },
  "reflex-ring": {
    category: "reflex",
    ageRating: "everyone",
    keywords: [
      "reflex ring game",
      "tap timing game",
      "reaction speed game",
      "free reflex game",
      "spinning arrow game",
      "timing tap game",
    ],
    shortDescription:
      "Tap when the arrow hits the bright segment. It speeds up every round. Free, no ads.",
  },
  snapadile: {
    category: "reflex",
    ageRating: "kids",
    keywords: [
      "crocodile game",
      "tap game for kids",
      "animal game",
      "reflex game kids",
      "whack a mole style",
      "free kids game",
    ],
    shortDescription:
      "Crocs are swimming for your raft! Tap them before they snap. Free, no ads, and great for small fingers.",
  },
  "car-crash": {
    category: "arcade",
    ageRating: "everyone",
    keywords: [
      "car dodge game",
      "lane switching game",
      "traffic game",
      "endless driving game",
      "free car game",
      "highway game",
    ],
    shortDescription:
      "Switch lanes and dodge the traffic. How far can you drive? A free little arcade game, no ads.",
  },
  "fill-the-cup": {
    category: "casual",
    ageRating: "everyone",
    keywords: [
      "pouring game",
      "fill glass game",
      "precision game",
      "hold and release game",
      "water pouring game",
      "timing game",
    ],
    shortDescription:
      "Hold to pour, let go to stop. Fill each glass to the line without spilling. Free, no ads.",
  },
  "flash-bash": {
    category: "memory",
    ageRating: "kids",
    keywords: [
      "simon says game",
      "memory sequence game",
      "pattern memory game",
      "color memory game",
      "brain game kids",
      "free memory game",
    ],
    shortDescription:
      "Watch the lights, then copy the pattern. How long a sequence can you remember? Free memory game, no ads.",
  },
  "ho-ho-home-delivery": {
    category: "arcade",
    ageRating: "kids",
    keywords: [
      "christmas game",
      "santa game",
      "present delivery game",
      "holiday game free",
      "chimney game",
      "kids christmas game",
    ],
    shortDescription:
      "Help Santa drop presents down the chimneys. A free Christmas game, no ads.",
  },
  "ready-steady-shoot": {
    category: "sports",
    ageRating: "everyone",
    keywords: [
      "basketball game",
      "shooting game",
      "aim and shoot game",
      "free basketball game",
      "hoop game",
      "sports arcade game",
    ],
    shortDescription:
      "Aim, pick your power and shoot for the hoop. A free basketball game, no ads.",
  },
  "paddle-pop": {
    category: "arcade",
    ageRating: "everyone",
    keywords: [
      "paddle game",
      "breakout game",
      "brick breaker",
      "pong style game",
      "ball bounce game",
      "free arcade game",
    ],
    shortDescription:
      "Bounce the ball, hit the targets, grab the power-ups. A free paddle game, no ads.",
  },
  "word-rush": {
    category: "word",
    ageRating: "everyone",
    keywords: [
      "word guess game",
      "timed word game",
      "word puzzle online",
      "free word game",
      "letter game",
      "vocabulary quiz",
    ],
    shortDescription:
      "Pick your letters, then guess the hidden words before the clock runs out. Free word game, no ads.",
  },
  serpento: {
    category: "arcade",
    ageRating: "everyone",
    keywords: [
      "snake game",
      "classic snake",
      "retro snake game",
      "free snake game",
      "grow and survive",
      "endless snake",
    ],
    shortDescription:
      "Eat to grow, don't hit the walls (or yourself). Our take on the classic snake game. Free, no ads.",
  },
  blocker: {
    category: "puzzle",
    ageRating: "everyone",
    keywords: [
      "block puzzle game",
      "tetris style game",
      "line clear game",
      "10x10 puzzle",
      "free puzzle game",
      "brain teaser game",
    ],
    shortDescription:
      "Drop blocks, clear lines, chain combos. Easy to start, hard to stop. Free puzzle game, no ads.",
  },
  "hoop-city": {
    category: "arcade",
    ageRating: "everyone",
    keywords: [
      "flappy game",
      "hoop game",
      "city flying game",
      "tap to fly game",
      "endless arcade game",
      "free casual game",
    ],
    shortDescription:
      "Tap to float the ball through hoops as the city scrolls past. Free, no ads, one more go guaranteed.",
  },
  "cosmic-clash": {
    category: "action",
    ageRating: "everyone",
    keywords: [
      "space invaders game",
      "alien shooter",
      "space shooter game",
      "retro shooter",
      "free shooting game",
      "arcade shooter",
    ],
    shortDescription:
      "Blast the space invaders, grab power-ups and survive the waves. Free shooter, no ads.",
  },
  "block-breaker": {
    category: "arcade",
    ageRating: "everyone",
    keywords: [
      "brick breaker game",
      "breakout game",
      "ball and paddle game",
      "arkanoid style",
      "free brick game",
      "classic arcade",
    ],
    shortDescription:
      "Smash every brick with your ball. The classic brick breaker, free and with no ads.",
  },
  "box-cutter": {
    category: "arcade",
    ageRating: "everyone",
    keywords: [
      "territory game",
      "qix style game",
      "capture game",
      "line drawing game",
      "area capture game",
      "free arcade game",
    ],
    shortDescription:
      "Draw lines to box off the board while dodging the fireball. Free, no ads, very satisfying.",
  },
};

/**
 * Build a combined keywords string for a game
 */
export function buildGameKeywords(gameId: string): string {
  const gameMeta = GAME_SEO_META[gameId];
  if (!gameMeta) {
    return SITE_KEYWORDS.slice(0, 10).join(", ");
  }

  const categoryKeywords = CATEGORY_KEYWORDS[gameMeta.category] || [];
  const combined = [
    ...gameMeta.keywords,
    ...categoryKeywords.slice(0, 3),
    ...SITE_KEYWORDS.slice(0, 5),
  ];

  // Dedupe and limit
  return [...new Set(combined)].slice(0, 15).join(", ");
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
    image: game.thumbnail
      ? `${SITE_URL}${game.thumbnail}`
      : `${SITE_URL}${brand.logoSquare}`,
    gamePlatform: ["Web Browser", "Mobile Browser", "PWA"],
    applicationCategory: "Game",
    genre: getCategoryGenre(category),
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
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
  games: Array<{ id: string; title: string; thumbnail?: string }>
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Games on ${brand.name}`,
    description:
      `Little games made by ${makersLine()}. Free, no ads, no download.`,
    numberOfItems: games.length,
    itemListElement: games.slice(0, 20).map((game, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "VideoGame",
        name: game.title,
        url: `${SITE_URL}/games/${game.id}`,
        image: game.thumbnail
          ? `${SITE_URL}${game.thumbnail}`
          : `${SITE_URL}${brand.logoSquare}`,
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
