/**
 * SEO Keywords and Categories for Games
 *
 * Central configuration for SEO metadata across all games.
 * These keywords are optimized for discoverability of free, kid-friendly,
 * browser-based games.
 */

export const SITE_NAME = "flingo.fun";
export const SITE_URL = "https://flingo.fun";
export const SITE_TAGLINE = "Free Online Games for Everyone";

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
  "safe games for kids",
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
      "Build a stack of 5-letter words by dragging letters! Free word puzzle game - play instantly in your browser.",
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
      "Test your reflexes! Tap when the arrow hits the target. Free reaction game - gets faster as you score!",
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
      "Tap the crocodiles before they reach your raft! Fun, free reflex game perfect for kids.",
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
      "Switch lanes to dodge traffic! Free endless arcade game - how far can you drive?",
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
      "Hold to pour, release to stop! Fill each glass perfectly in this free precision game.",
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
      "Watch the pattern, repeat it! Free Simon Says-style memory game for all ages.",
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
      "Help Santa deliver presents! Drop gifts into chimneys in this free Christmas arcade game.",
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
      "Aim, set power, and shoot! Score baskets in this free basketball arcade game.",
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
    shortDescription: "Bounce the ball, hit targets, collect power-ups! Free arcade paddle game.",
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
      "Guess words before time runs out! Free timed word puzzle game - test your vocabulary!",
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
      "Classic snake game - eat to grow, avoid walls! Free retro arcade game for all ages.",
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
      "Place blocks, clear lines, chase combos! Free puzzle game - simple to learn, hard to master.",
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
    shortDescription: "Tap to float through hoops over the city skyline! Free endless arcade game.",
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
      "Blast alien invaders in this free Space Invaders-style shooter! Collect power-ups, survive waves.",
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
      "Break all the bricks with your ball! Classic brick breaker arcade game - play free.",
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
      "Draw lines to capture territory! Avoid the enemy ball in this free Qix-style arcade game.",
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
  return "Play free online games at flingo.fun! Fun, skill-based games you can play instantly.";
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
      : `${SITE_URL}/assets/shared/logo_square.png`,
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
    name: "Free Online Games at flingo.fun",
    description:
      "Collection of free, kid-friendly browser games. Play instantly - no download required!",
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
          : `${SITE_URL}/assets/shared/logo_square.png`,
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
    alternateName: "Flingo Games",
    url: SITE_URL,
    description:
      "Play free online games at flingo.fun! Kid-friendly, browser-based games you can play instantly on any device.",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/assets/shared/logo_square.png`,
      },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
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
    url: SITE_URL,
    logo: `${SITE_URL}/assets/shared/logo_square.png`,
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${SITE_URL}/`,
    },
  };
}
