import type { RatingSummary } from "../lib/api";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
type CacheEntry = { summary: RatingSummary; timestamp: number };

const cache = new Map<string, CacheEntry>();

function sanitize(summary: RatingSummary): RatingSummary {
  return {
    gameId: summary.gameId,
    avgRating: summary.avgRating,
    ratingCount: summary.ratingCount,
    updatedAt: summary.updatedAt,
  };
}

export function getCachedRatingSummary(gameId: string): RatingSummary | null {
  const entry = cache.get(gameId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(gameId);
    return null;
  }
  return entry.summary;
}

export function setCachedRatingSummary(summary: RatingSummary) {
  cache.set(summary.gameId, { summary: sanitize(summary), timestamp: Date.now() });
}

export function primeRatingCache(list: RatingSummary[]) {
  list.forEach((summary) => setCachedRatingSummary(summary));
}

export function invalidateRatingCache(gameId?: string) {
  if (!gameId) {
    cache.clear();
    return;
  }
  cache.delete(gameId);
}
