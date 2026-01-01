/**
 * Optimized Feed Algorithm Hook
 *
 * Strategy for instant display with 100s of games:
 *
 * 1. INSTANT RENDER: Show games immediately using client-side sorting
 *    - Uses cached ratings + local play history
 *    - No network blocking on initial render
 *
 * 2. BACKGROUND FETCH: Request personalized order from backend
 *    - Backend has full rating data + user play history from DB
 *    - Returns just ordered IDs (small payload)
 *
 * 3. SMOOTH UPDATE: Merge backend order without jarring UI changes
 *    - Only reorder after user has scrolled past initial view
 *    - Or update seamlessly if order is similar
 *
 * 4. PAGINATION: Backend API supports cursor-based pagination
 *    - Initial request: first 20 games
 *    - Load more as user scrolls
 */

import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { RatingSummary } from "../lib/api";
import { useAuth } from "../context/FirebaseAuthProvider";
import { GameCatalogEntry } from "./useGameCatalog";
import { getIdToken } from "../lib/firebase";

const LAST_PLAYED_KEY = "flingo_last_played_games";
const MAX_LAST_PLAYED = 10;
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

// Feed scoring reasons
export type FeedReason =
  | "user_recent" // User recently played
  | "beta" // Beta game for beta tester
  | "updated" // Recently updated
  | "new" // New release
  | "rated" // Recently rated by community
  | "featured" // Admin-featured game
  | "campaign" // Part of active campaign
  | "popular"; // Default popularity-based

export type FeedGame = GameCatalogEntry & {
  feedScore: number;
  feedReason: FeedReason;
  /** Index in feed for stable keys during infinite scroll */
  feedIndex: number;
};

/**
 * Get list of recently played game IDs from localStorage
 */
export function getLastPlayedGames(): string[] {
  try {
    const stored = localStorage.getItem(LAST_PLAYED_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

/**
 * Record a game as recently played
 */
export function recordGamePlayed(gameId: string): void {
  try {
    const current = getLastPlayedGames().filter((id) => id !== gameId);
    const updated = [gameId, ...current].slice(0, MAX_LAST_PLAYED);
    localStorage.setItem(LAST_PLAYED_KEY, JSON.stringify(updated));
  } catch {
    // localStorage not available
  }
}

// Backend feed response
interface FeedApiResponse {
  orderedGameIds: string[];
  scores: Record<string, number>;
  reasons?: Record<string, FeedReason>;
  nextCursor?: string;
}

/**
 * Fetch feed order from backend (lightweight - just IDs)
 */
async function fetchFeedOrder(params: {
  isAuthenticated: boolean;
  clientRecentGames: string[];
  limit?: number;
  cursor?: string;
}): Promise<FeedApiResponse | null> {
  const { isAuthenticated, clientRecentGames, limit = 50, cursor } = params;

  const endpoint = isAuthenticated ? "/games/feed/personalized" : "/games/feed";
  const queryParams = new URLSearchParams();
  queryParams.set("limit", String(limit));

  if (cursor) {
    queryParams.set("cursor", cursor);
  }

  if (clientRecentGames.length > 0) {
    queryParams.set("clientRecentGames", clientRecentGames.join(","));
  }

  try {
    // Build headers with auth token if authenticated
    const headers: Record<string, string> = {};
    if (isAuthenticated) {
      const token = await getIdToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${API_BASE}${endpoint}?${queryParams}`, {
      headers,
    });

    if (!response.ok) {
      console.error("Feed API error:", response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error("Failed to fetch feed:", err);
    return null;
  }
}

/**
 * Client-side scoring algorithm for instant display
 * This runs synchronously with no network calls
 */
function computeInstantFeed(
  games: GameCatalogEntry[],
  ratings: Record<string, RatingSummary>,
  isBetaTester: boolean
): FeedGame[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const lastPlayedIds = getLastPlayedGames();
  const dailySeed = Math.floor(now / dayMs);

  const scoredGames = games.map((game, index): FeedGame => {
    let score = 0;
    let reason: FeedReason = "popular";

    const updatedAt = game.updatedAt ? new Date(game.updatedAt).getTime() : 0;
    const createdAt = game.createdAt ? new Date(game.createdAt).getTime() : 0;
    const rating = ratings[game.id];

    // 1. Featured games (admin-controlled) - highest priority
    if (game.featured) {
      score += 1200;
      reason = "featured";
    }

    // 2. Active campaign
    if (game.campaignId) {
      score += 1000;
      if (reason === "popular") reason = "campaign";
    }

    // 3. User recently played (but not the very last one)
    const lastPlayedIndex = lastPlayedIds.indexOf(game.id);
    if (lastPlayedIndex !== -1) {
      // Don't boost most recent (they just played it), boost 2nd-5th
      const boost = lastPlayedIndex === 0 ? 200 : 900 - lastPlayedIndex * 80;
      score += Math.max(boost, 50);
      if (reason === "popular") reason = "user_recent";
    }

    // 4. Beta games for beta testers
    if (isBetaTester && game.betaOnly) {
      score += 800;
      if (reason === "popular") reason = "beta";
    }

    // 5. Recently updated (within 7 days)
    const daysSinceUpdate = (now - updatedAt) / dayMs;
    if (daysSinceUpdate <= 7 && updatedAt > createdAt) {
      score += Math.max(0, 500 - daysSinceUpdate * 70);
      if (reason === "popular") reason = "updated";
    }

    // 6. New games (within 14 days)
    const daysSinceCreation = (now - createdAt) / dayMs;
    if (daysSinceCreation <= 14) {
      score += Math.max(0, 400 - daysSinceCreation * 28);
      if (reason === "popular") reason = "new";
    }

    // 7. Rating-based popularity
    if (rating?.avgRating && rating.ratingCount > 0) {
      const qualityScore = rating.avgRating * 20; // Max 100
      const volumeScore = Math.min(rating.ratingCount, 50) * 2; // Max 100
      score += qualityScore + volumeScore;
    }

    // 8. Daily variety factor
    const gameHash = game.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    score += (((dailySeed + gameHash) % 100) / 100) * 50;

    return {
      ...game,
      feedScore: score,
      feedReason: reason,
      feedIndex: index,
    };
  });

  // Sort by score
  scoredGames.sort((a, b) => b.feedScore - a.feedScore);

  // Re-assign feedIndex after sorting
  scoredGames.forEach((game, idx) => {
    game.feedIndex = idx;
  });

  return scoredGames;
}

/**
 * Apply backend ordering to games
 */
function applyBackendOrder(games: GameCatalogEntry[], apiResponse: FeedApiResponse): FeedGame[] {
  const gameMap = new Map(games.map((g) => [g.id, g]));
  const result: FeedGame[] = [];
  const addedIds = new Set<string>();

  // Add games in backend-specified order
  apiResponse.orderedGameIds.forEach((gameId, index) => {
    const game = gameMap.get(gameId);
    if (game) {
      result.push({
        ...game,
        feedScore: apiResponse.scores[gameId] || 0,
        feedReason: apiResponse.reasons?.[gameId] || "popular",
        feedIndex: index,
      });
      addedIds.add(gameId);
    }
  });

  // Add any remaining games not in backend response
  games.forEach((game) => {
    if (!addedIds.has(game.id)) {
      result.push({
        ...game,
        feedScore: 0,
        feedReason: "popular",
        feedIndex: result.length,
      });
    }
  });

  return result;
}

export type FeedAlgorithmInput = {
  games: GameCatalogEntry[];
  ratings: Record<string, RatingSummary>;
  isBetaTester: boolean;
};

export type FeedState = {
  /** Sorted games ready for display */
  games: FeedGame[];
  /** Whether backend data is still loading */
  isLoading: boolean;
  /** Whether we have personalized data from backend */
  isPersonalized: boolean;
  /** Load more games for infinite scroll */
  loadMore: () => void;
  /** Whether there are more games to load */
  hasMore: boolean;
};

/**
 * Optimized feed algorithm hook
 *
 * Shows games INSTANTLY using client-side sorting,
 * then updates with backend personalization in background.
 *
 * IMPORTANT: Backend order is only applied to games BEYOND what the user
 * has already seen, to prevent jarring reorders of visible content.
 *
 * LOADING BEHAVIOR:
 * - Shows loading skeleton initially
 * - If backend responds < 1.5s: show backend-ordered games immediately
 * - If backend takes > 1.5s: show client-sorted games, apply backend to off-screen later
 */
export function useFeedAlgorithm({ games, ratings, isBetaTester }: FeedAlgorithmInput): {
  games: FeedGame[];
  isLoading: boolean;
} {
  const { user, initialized } = useAuth();
  const [backendResponse, setBackendResponse] = useState<FeedApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  // Track games that have been "locked" (shown to user)
  // This prevents reordering games the user has already seen
  const lockedGamesRef = useRef<FeedGame[]>([]);

  // Compute instant feed (synchronous, no blocking)
  const instantFeed = useMemo(
    () => computeInstantFeed(games, ratings, isBetaTester),
    [games, ratings, isBetaTester]
  );

  // Lock initial games when we show them (fallback after timeout)
  useEffect(() => {
    if (instantFeed.length > 0 && lockedGamesRef.current.length === 0 && !isLoading) {
      // Lock first batch of games (what fits on screen + buffer)
      const initialLockCount = Math.min(8, instantFeed.length);
      lockedGamesRef.current = instantFeed.slice(0, initialLockCount);
    }
  }, [instantFeed, isLoading]);

  // Fetch backend personalization in background (wait for auth first)
  useEffect(() => {
    // Wait for auth to initialize to know which endpoint to use
    if (!initialized) return;

    // Only fetch once per mount (or when user changes)
    if (fetchedRef.current && backendResponse !== null) return;

    let cancelled = false;

    // Set timeout to fallback to instant feed after 1.5s
    if (typeof window !== "undefined") {
      timeoutRef.current = window.setTimeout(() => {
        if (!cancelled && backendResponse === null) {
          console.log("Feed: Backend took >1.5s, showing client-sorted feed");
          setIsLoading(false);
        }
      }, 1500);
    }

    async function loadBackendOrder() {
      const response = await fetchFeedOrder({
        isAuthenticated: !!user,
        clientRecentGames: getLastPlayedGames(),
        limit: 100, // Get all games in one request for now
      });

      if (!cancelled) {
        // Clear timeout since we got response
        if (timeoutRef.current && typeof window !== "undefined") {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        if (response) {
          setBackendResponse(response);
          fetchedRef.current = true;
        }

        // Stop loading now that we have response (or failed)
        setIsLoading(false);
      }
    }

    if (games.length > 0) {
      loadBackendOrder();
    }

    return () => {
      cancelled = true;
      if (timeoutRef.current && typeof window !== "undefined") {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [user, games.length, initialized, backendResponse]);

  // Reset when user changes
  useEffect(() => {
    fetchedRef.current = false;
    setBackendResponse(null);
    lockedGamesRef.current = [];
    setIsLoading(true);
  }, [user?.userId]);

  // Final feed: merge locked games with backend-ordered remaining games
  const finalFeed = useMemo(() => {
    // If still loading, return empty array (will show skeleton)
    if (isLoading) {
      return [];
    }

    // If no backend response yet, just use instant feed
    if (!backendResponse?.orderedGameIds?.length) {
      return instantFeed;
    }

    // Get the IDs of games that are locked (already shown)
    const lockedIds = new Set(lockedGamesRef.current.map((g) => g.id));

    // Start with locked games (preserve their order)
    const result: FeedGame[] = [...lockedGamesRef.current];

    // Get backend-ordered games that aren't locked
    const backendOrdered = applyBackendOrder(games, backendResponse);
    const remainingGames = backendOrdered.filter((g) => !lockedIds.has(g.id));

    // Add remaining games after locked ones, updating their feedIndex
    remainingGames.forEach((game, idx) => {
      result.push({
        ...game,
        feedIndex: lockedGamesRef.current.length + idx,
      });
    });

    return result;
  }, [games, backendResponse, instantFeed, isLoading]);

  return { games: finalFeed, isLoading };
}

/**
 * Hook for infinite scroll with cycling
 */
export function useInfiniteFeed(feedGames: FeedGame[]) {
  const getInfiniteItems = useCallback(
    (count: number): FeedGame[] => {
      if (feedGames.length === 0) return [];

      // Create infinite feed by cycling through games
      const result: FeedGame[] = [];
      for (let i = 0; i < count; i++) {
        const sourceGame = feedGames[i % feedGames.length];
        result.push({
          ...sourceGame,
          // Unique feedIndex for each position in infinite scroll
          feedIndex: i,
        });
      }
      return result;
    },
    [feedGames]
  );

  return {
    getInfiniteItems,
    totalGames: feedGames.length,
  };
}

// Re-export types for backwards compatibility
export type { FeedGame as FeedGameLegacy };
