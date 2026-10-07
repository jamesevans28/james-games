/**
 * Game Catalog Hook
 *
 * Provides a unified view of games that:
 * 1. Shows games INSTANTLY from the bundled index (has load() functions)
 * 2. HYDRATES with backend config data (admin-managed metadata)
 * 3. Supports future campaigns/promotions via backend metadata
 *
 * The bundled games/index.ts contains:
 * - id, load() function (required for code-splitting)
 * - Basic fallback title/description
 *
 * The backend gameConfigs table supplies admin-managed extras only:
 * - betaOnly
 * - metadata: { campaigns, featured, promoText, etc. }
 *
 * Display fields (title, copy, thumbnail, dates) stay bundled: the server rows are
 * stale (e.g. old SVG thumbnails) and Phase 4 manifests become their source of truth.
 * XP multipliers are server-side only (T1.4), so they are not merged either.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { games as bundledGames, type GameMeta } from "../games";
import { API_BASE_URL } from "../config/env";

const API_BASE = API_BASE_URL;
const CACHE_KEY = "flingo_game_catalog_cache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Extended game type with backend-managed fields
export type GameCatalogEntry = GameMeta & {
  // Backend-managed display fields
  promoText?: string;
  featured?: boolean;
  campaignId?: string;
  campaignBadge?: string;
  // Metadata from admin
  metadata?: {
    campaigns?: Array<{
      id: string;
      name: string;
      badge?: string;
      startDate?: string;
      endDate?: string;
      priority?: number;
    }>;
    featured?: boolean;
    promoText?: string;
    tags?: string[];
    difficulty?: "easy" | "medium" | "hard";
    ageRating?: string;
    [key: string]: unknown;
  } | null;
};

// Backend response shape
interface BackendGameConfig {
  gameId: string;
  title: string;
  description?: string;
  objective?: string;
  controls?: string;
  thumbnail?: string;
  xpMultiplier?: number;
  betaOnly?: boolean;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any> | null;
}

interface CatalogCache {
  timestamp: number;
  configs: Record<string, BackendGameConfig>;
}

/**
 * Load cached catalog from localStorage
 */
function loadCache(): CatalogCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogCache;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      return null; // Expired
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save catalog to localStorage cache
 */
function saveCache(configs: Record<string, BackendGameConfig>): void {
  try {
    const cache: CatalogCache = {
      timestamp: Date.now(),
      configs,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Fetch all game configs from backend
 */
async function fetchGameConfigs(): Promise<BackendGameConfig[]> {
  if (!API_BASE) return [];
  const allConfigs: BackendGameConfig[] = [];
  let cursor: string | undefined;

  // Paginate through all games (handles 100s of games)
  do {
    const url = new URL("/games/config", API_BASE);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    allConfigs.push(...(data.items || []));
    cursor = data.nextCursor;
  } while (cursor);

  return allConfigs;
}

/**
 * Merge bundled game with backend config
 * Backend is source of truth for display data
 */
function mergeGameData(bundled: GameMeta, backend?: BackendGameConfig | null): GameCatalogEntry {
  if (!backend) {
    // No backend config yet - use bundled data
    return { ...bundled, metadata: null };
  }

  // Parse active campaign from metadata
  const now = new Date();
  const campaigns = backend.metadata?.campaigns as
    | Array<{
        id: string;
        name: string;
        badge?: string;
        startDate?: string;
        endDate?: string;
        priority?: number;
      }>
    | undefined;

  const activeCampaign = campaigns
    ?.filter((c) => {
      if (c.startDate && new Date(c.startDate) > now) return false;
      if (c.endDate && new Date(c.endDate) < now) return false;
      return true;
    })
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];

  return {
    // Keep the load() function from bundled (required)
    ...bundled,
    // Admin-managed extras only; display fields stay bundled (see header comment).
    betaOnly: backend.betaOnly ?? bundled.betaOnly,
    // Campaign/promo data
    metadata: backend.metadata,
    featured: backend.metadata?.featured === true,
    promoText: backend.metadata?.promoText as string | undefined,
    campaignId: activeCampaign?.id,
    campaignBadge: activeCampaign?.badge,
  };
}

export type GameCatalogState = {
  /** All games, instantly available (bundled + cached backend data) */
  games: GameCatalogEntry[];
  /** Whether backend data is still loading */
  isHydrating: boolean;
  /** Whether we have fresh backend data */
  isHydrated: boolean;
  /** Error if backend fetch failed */
  error: Error | null;
  /** Force refresh from backend */
  refresh: () => Promise<void>;
  /** Get a specific game by ID */
  getGame: (id: string) => GameCatalogEntry | undefined;
};

/**
 * Hook to access the game catalog with instant display + backend hydration
 */
export function useGameCatalog(): GameCatalogState {
  // Backend configs (from cache initially, then fresh)
  const [backendConfigs, setBackendConfigs] = useState<Record<string, BackendGameConfig>>(() => {
    const cached = loadCache();
    return cached?.configs || {};
  });
  const [isHydrating, setIsHydrating] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch fresh data from backend
  const refresh = useCallback(async () => {
    setIsHydrating(true);
    setError(null);
    try {
      const configs = await fetchGameConfigs();
      const configMap: Record<string, BackendGameConfig> = {};
      configs.forEach((c) => {
        configMap[c.gameId] = c;
      });
      setBackendConfigs(configMap);
      saveCache(configMap);
      setIsHydrated(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch game configs"));
    } finally {
      setIsHydrating(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Merge bundled games with backend configs
  const games = useMemo((): GameCatalogEntry[] => {
    return bundledGames.map((bundled) => mergeGameData(bundled, backendConfigs[bundled.id]));
  }, [backendConfigs]);

  const getGame = useCallback(
    (id: string): GameCatalogEntry | undefined => {
      const bundled = bundledGames.find((g) => g.id === id);
      if (!bundled) return undefined;
      return mergeGameData(bundled, backendConfigs[id]);
    },
    [backendConfigs]
  );

  return {
    games,
    isHydrating,
    isHydrated,
    error,
    refresh,
    getGame,
  };
}

/**
 * Filter games by beta access
 */
export function filterByBetaAccess(
  games: GameCatalogEntry[],
  isBetaTester: boolean
): GameCatalogEntry[] {
  return isBetaTester ? games : games.filter((g) => !g.betaOnly);
}

/**
 * Filter games by active campaign
 */
export function filterByCampaign(
  games: GameCatalogEntry[],
  campaignId: string
): GameCatalogEntry[] {
  return games.filter((g) => g.campaignId === campaignId);
}

/**
 * Get featured games
 */
export function getFeaturedGames(games: GameCatalogEntry[]): GameCatalogEntry[] {
  return games.filter((g) => g.featured);
}
