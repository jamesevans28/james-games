import { useMemo, useCallback, useState, useEffect } from "react";
import { GameMeta } from "../games";
import { RatingSummary } from "../lib/api";
import { useAuth } from "../context/FirebaseAuthProvider";
import { getIdToken } from "../lib/firebase";

const LAST_PLAYED_KEY = "flingo_last_played_games";
const MAX_LAST_PLAYED = 10;
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

export type FeedAlgorithmInput = {
  games: GameMeta[];
  ratings: Record<string, RatingSummary>;
  isBetaTester: boolean;
};

export type FeedGame = GameMeta & {
  feedScore: number;
  feedReason?: "user_recent" | "beta" | "updated" | "new" | "rated" | "popular";
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

interface FeedApiResponse {
  orderedGameIds: string[];
  scores: Record<string, number>;
  ratings: Record<string, { avgRating: number; ratingCount: number }>;
  userRecentGames?: string[];
}

/**
 * Fetch feed order from backend API
 */
async function fetchFeedOrder(params: {
  gameIds: string[];
  gameMetadata: Record<string, { createdAt?: string; updatedAt?: string; betaOnly?: boolean }>;
  isAuthenticated: boolean;
  clientRecentGames: string[];
}): Promise<FeedApiResponse | null> {
  const { gameIds, gameMetadata, isAuthenticated, clientRecentGames } = params;

  if (gameIds.length === 0) return null;

  const endpoint = isAuthenticated ? "/games/feed/personalized" : "/games/feed";
  const queryParams = new URLSearchParams({
    gameIds: gameIds.join(","),
    metadata: JSON.stringify(gameMetadata),
  });

  if (isAuthenticated && clientRecentGames.length > 0) {
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
 * Client-side fallback algorithm (used when API fails)
 */
function computeClientFallback(
  games: GameMeta[],
  ratings: Record<string, RatingSummary>,
  isBetaTester: boolean
): FeedGame[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const lastPlayedIds = getLastPlayedGames();
  const dailySeed = Math.floor(now / dayMs);

  const scoredGames: FeedGame[] = games.map((game) => {
    let score = 0;
    let reason: FeedGame["feedReason"] = "popular";

    const updatedAt = game.updatedAt ? new Date(game.updatedAt).getTime() : 0;
    const createdAt = game.createdAt ? new Date(game.createdAt).getTime() : 0;
    const rating = ratings[game.id];

    // Last played
    const lastPlayedIndex = lastPlayedIds.indexOf(game.id);
    if (lastPlayedIndex !== -1) {
      score += lastPlayedIndex === 0 ? 300 : 1000 - lastPlayedIndex * 100;
      reason = "user_recent";
    }

    // Beta boost
    if (isBetaTester && game.betaOnly) {
      score += 800;
      if (reason === "popular") reason = "beta";
    }

    // Recently updated
    const daysSinceUpdate = (now - updatedAt) / dayMs;
    if (daysSinceUpdate <= 7 && updatedAt > createdAt) {
      score += Math.max(0, 500 - daysSinceUpdate * 70);
      if (reason === "popular") reason = "updated";
    }

    // New games
    const daysSinceCreation = (now - createdAt) / dayMs;
    if (daysSinceCreation <= 14) {
      score += Math.max(0, 400 - daysSinceCreation * 28);
      if (reason === "popular") reason = "new";
    }

    // Ratings
    if (rating?.avgRating && rating.ratingCount > 0) {
      score += rating.avgRating * 20 + Math.min(rating.ratingCount, 50) * 2;
    }

    // Daily random
    const gameHash = game.id.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
    score += (((dailySeed + gameHash) % 100) / 100) * 50;

    return { ...game, feedScore: score, feedReason: reason };
  });

  scoredGames.sort((a, b) => b.feedScore - a.feedScore);
  return scoredGames;
}

/**
 * Feed algorithm hook that fetches ordering from the backend.
 * Falls back to client-side computation if API fails.
 *
 * The backend algorithm scores games based on:
 * 1. USER PERSONALIZATION: Recently played games (from DB or localStorage)
 * 2. BETA BOOST: Beta games for beta testers (+800 points)
 * 3. FRESHNESS: Recently updated games (7-day window, decaying)
 * 4. FRESHNESS: New releases (14-day window, decaying)
 * 5. FRESHNESS: Recently rated by community (3-day window)
 * 6. POPULARITY: Rating quality (avgRating × 20) + volume (count × 2)
 * 7. VARIETY: Daily pseudo-random factor (0-50 points)
 *
 * Results are interleaved to ensure variety in the feed.
 */
export function useFeedAlgorithm({ games, ratings, isBetaTester }: FeedAlgorithmInput): FeedGame[] {
  const { user, initialized } = useAuth();
  const [apiResponse, setApiResponse] = useState<FeedApiResponse | null>(null);

  // Prepare game metadata for API
  const gameMetadata = useMemo(() => {
    const meta: Record<string, { createdAt?: string; updatedAt?: string; betaOnly?: boolean }> = {};
    games.forEach((g) => {
      meta[g.id] = {
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
        betaOnly: g.betaOnly,
      };
    });
    return meta;
  }, [games]);

  const gameIds = useMemo(() => games.map((g) => g.id), [games]);

  // Fetch feed from backend (wait for auth to initialize first)
  useEffect(() => {
    // Don't fetch until we know auth state to avoid wrong endpoint / 401s
    if (!initialized) return;

    let cancelled = false;

    async function load() {
      const response = await fetchFeedOrder({
        gameIds,
        gameMetadata,
        isAuthenticated: !!user,
        clientRecentGames: getLastPlayedGames(),
      });

      if (!cancelled) {
        setApiResponse(response);
      }
    }

    if (gameIds.length > 0) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [gameIds, gameMetadata, user, initialized]);

  // Build final feed
  const sortedFeed = useMemo(() => {
    // If API succeeded, use its ordering
    if (apiResponse?.orderedGameIds) {
      const gameMap = new Map(games.map((g) => [g.id, g]));
      const result: FeedGame[] = [];

      for (const gameId of apiResponse.orderedGameIds) {
        const game = gameMap.get(gameId);
        if (game) {
          result.push({
            ...game,
            feedScore: apiResponse.scores[gameId] || 0,
            feedReason: "popular", // Could parse from API if needed
          });
        }
      }

      // Add any games missing from API response
      for (const game of games) {
        if (!apiResponse.orderedGameIds.includes(game.id)) {
          result.push({ ...game, feedScore: 0, feedReason: "popular" });
        }
      }

      return result;
    }

    // Fallback to client-side computation
    return computeClientFallback(games, ratings, isBetaTester);
  }, [games, ratings, isBetaTester, apiResponse]);

  return sortedFeed;
}

/**
 * Hook to get feed games with infinite scroll support
 */
export function useInfiniteFeed(feedGames: FeedGame[]) {
  const getInfiniteItems = useCallback(
    (count: number): FeedGame[] => {
      if (feedGames.length === 0) return [];

      // Repeat the feed to create "infinite" scrolling
      const result: FeedGame[] = [];
      for (let i = 0; i < count; i++) {
        result.push(feedGames[i % feedGames.length]);
      }
      return result;
    },
    [feedGames]
  );

  return { getInfiniteItems, totalGames: feedGames.length };
}
