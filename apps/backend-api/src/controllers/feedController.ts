import type { Request, Response } from "express";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";
import { listGameConfigs, GameConfigRecord } from "../services/gamesConfigService.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

const ddb = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Feed Algorithm - Server-Side Scoring
 *
 * The algorithm computes a score for each game based on multiple factors.
 * Higher scores appear first in the feed.
 *
 * SCORING FACTORS:
 *
 * 1. FEATURED: Admin-marked featured games (+1200)
 * 2. CAMPAIGNS: Games in active campaigns (+1000)
 * 3. USER PERSONALIZATION: Recently played by user (900-50 points)
 * 4. BETA BOOST: Beta games for beta testers (+800)
 * 5. FRESHNESS: Recently updated (7-day window, decaying)
 * 6. FRESHNESS: New releases (14-day window, decaying)
 * 7. FRESHNESS: Recently rated by community (3-day window)
 * 8. POPULARITY: Rating quality + volume
 * 9. VARIETY: Daily pseudo-random factor
 */

type FeedReason =
  | "featured"
  | "campaign"
  | "user_recent"
  | "beta"
  | "updated"
  | "new"
  | "rated"
  | "popular";

interface GameScoreResult {
  gameId: string;
  score: number;
  reason: FeedReason;
}

interface RatingSummaryItem {
  gameId?: string;
  ratingSum?: number;
  ratingCount?: number;
  updatedAt?: string;
}

interface UserGameStatItem {
  gameId?: string;
  lastPlayedAt?: string;
  playCount?: number;
}

/**
 * Get all game configs from DB (cached in memory for 60s)
 */
let gameConfigsCache: { data: GameConfigRecord[]; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 60 seconds

async function getCachedGameConfigs(): Promise<GameConfigRecord[]> {
  if (gameConfigsCache && Date.now() - gameConfigsCache.timestamp < CACHE_TTL) {
    return gameConfigsCache.data;
  }

  const allConfigs: GameConfigRecord[] = [];
  let cursor: string | undefined;

  do {
    const result = await listGameConfigs({ limit: 100, cursor });
    allConfigs.push(...result.items);
    cursor = result.nextCursor;
  } while (cursor);

  gameConfigsCache = { data: allConfigs, timestamp: Date.now() };
  return allConfigs;
}

/**
 * Get rating data for all games
 */
async function getRatingData(): Promise<
  Map<string, { avgRating: number; ratingCount: number; updatedAt?: string }>
> {
  const stats = new Map<string, { avgRating: number; ratingCount: number; updatedAt?: string }>();

  try {
    const result = await ddb.send(
      new ScanCommand({
        TableName: config.tables.ratingSummary,
        ProjectionExpression: "gameId, ratingSum, ratingCount, updatedAt",
      })
    );

    ((result.Items || []) as RatingSummaryItem[]).forEach((item) => {
      if (item.gameId) {
        const ratingCount = Number(item.ratingCount ?? 0) || 0;
        const ratingSum = Number(item.ratingSum ?? 0) || 0;
        const avgRating = ratingCount > 0 ? ratingSum / ratingCount : 0;
        stats.set(item.gameId, { avgRating, ratingCount, updatedAt: item.updatedAt });
      }
    });
  } catch (err) {
    console.error("Failed to get rating data:", err);
  }

  return stats;
}

/**
 * Get user's recently played games from userGameStats table
 */
async function getUserRecentGames(userId: string): Promise<string[]> {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: config.tables.userGameStats,
        IndexName: config.tables.userRecentGamesIndex,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
        ProjectionExpression: "gameId, lastPlayedAt",
        ScanIndexForward: false, // Most recent first
        Limit: 20,
      })
    );

    return ((result.Items || []) as UserGameStatItem[])
      .filter((item) => item.gameId)
      .map((item) => item.gameId!);
  } catch (err) {
    // Index may not exist yet - gracefully degrade
    console.error("Failed to get user recent games:", err);
    return [];
  }
}

/**
 * Check if a campaign is currently active
 */
function isActiveCampaign(campaign: any): boolean {
  if (!campaign) return false;
  const now = new Date();
  if (campaign.startDate && new Date(campaign.startDate) > now) return false;
  if (campaign.endDate && new Date(campaign.endDate) < now) return false;
  return true;
}

/**
 * Compute feed scores for all games
 */
function computeFeedScores(params: {
  gameConfigs: GameConfigRecord[];
  ratings: Map<string, { avgRating: number; ratingCount: number; updatedAt?: string }>;
  userRecentGames: string[];
  isBetaTester: boolean;
}): GameScoreResult[] {
  const { gameConfigs, ratings, userRecentGames, isBetaTester } = params;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const dailySeed = Math.floor(now / dayMs);

  return gameConfigs.map((game) => {
    let score = 0;
    let reason: FeedReason = "popular";

    const rating = ratings.get(game.gameId);
    const updatedAt = game.updatedAt ? new Date(game.updatedAt).getTime() : 0;
    const createdAt = game.createdAt ? new Date(game.createdAt).getTime() : 0;
    const metadata = game.metadata || {};

    // 1. FEATURED: Admin-marked featured games
    if (metadata.featured === true) {
      score += 1200;
      reason = "featured";
    }

    // 2. CAMPAIGNS: Games in active campaigns
    const campaigns = metadata.campaigns as any[] | undefined;
    const activeCampaign = campaigns?.find(isActiveCampaign);
    if (activeCampaign) {
      score += 1000 + (activeCampaign.priority || 0) * 10;
      if (reason === "popular") reason = "campaign";
    }

    // 3. USER PERSONALIZATION: Recently played games
    const recentIndex = userRecentGames.indexOf(game.gameId);
    if (recentIndex !== -1) {
      // Most recent gets less boost (they just played it), 2nd-5th get more
      const boost = recentIndex === 0 ? 200 : 900 - recentIndex * 80;
      score += Math.max(boost, 50);
      if (reason === "popular") reason = "user_recent";
    }

    // 4. BETA BOOST: For beta testers viewing beta games
    if (isBetaTester && game.betaOnly) {
      score += 800;
      if (reason === "popular") reason = "beta";
    }

    // 5. FRESHNESS: Recently updated (within 7 days)
    if (updatedAt > 0) {
      const daysSinceUpdate = (now - updatedAt) / dayMs;
      if (daysSinceUpdate <= 7 && updatedAt > createdAt) {
        score += Math.max(0, 500 - daysSinceUpdate * 70);
        if (reason === "popular") reason = "updated";
      }
    }

    // 6. FRESHNESS: New games (within 14 days)
    if (createdAt > 0) {
      const daysSinceCreation = (now - createdAt) / dayMs;
      if (daysSinceCreation <= 14) {
        score += Math.max(0, 400 - daysSinceCreation * 28);
        if (reason === "popular") reason = "new";
      }
    }

    // 7. FRESHNESS: Recently rated by community (within 3 days)
    if (rating?.updatedAt) {
      const ratingDate = new Date(rating.updatedAt).getTime();
      const daysSinceRating = (now - ratingDate) / dayMs;
      if (daysSinceRating <= 3) {
        score += Math.max(0, 300 - daysSinceRating * 100);
        if (reason === "popular") reason = "rated";
      }
    }

    // 8. POPULARITY: Rating quality and volume
    if (rating) {
      const qualityScore = rating.avgRating * 20; // Max 100 for 5-star
      const volumeScore = Math.min(rating.ratingCount, 50) * 2; // Max 100
      score += qualityScore + volumeScore;
    }

    // 9. VARIETY: Daily pseudo-random factor
    const gameHash = game.gameId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const pseudoRandom = ((dailySeed + gameHash) % 100) / 100;
    score += pseudoRandom * 50;

    return { gameId: game.gameId, score, reason };
  });
}

/**
 * Interleave results for variety
 */
function interleaveResults(scored: GameScoreResult[]): GameScoreResult[] {
  // Sort by score first
  const sorted = [...scored].sort((a, b) => b.score - a.score);

  // Group by reason
  const buckets: Record<FeedReason, GameScoreResult[]> = {
    featured: [],
    campaign: [],
    user_recent: [],
    beta: [],
    updated: [],
    new: [],
    rated: [],
    popular: [],
  };

  sorted.forEach((item) => {
    buckets[item.reason].push(item);
  });

  const result: GameScoreResult[] = [];
  const priorityOrder: FeedReason[] = [
    "featured",
    "campaign",
    "beta",
    "updated",
    "new",
    "user_recent",
    "rated",
    "popular",
  ];

  // First pass: one from each non-empty bucket
  for (const reason of priorityOrder) {
    if (buckets[reason].length > 0) {
      result.push(buckets[reason].shift()!);
    }
  }

  // Remaining: round-robin
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (const reason of priorityOrder) {
      if (buckets[reason].length > 0) {
        result.push(buckets[reason].shift()!);
        hasMore = true;
      }
    }
  }

  return result;
}

/**
 * GET /games/feed
 *
 * Returns the ordered feed for all games.
 * Uses game configs from DB (no client-side metadata needed).
 *
 * Query params:
 *   - limit: max games to return (default 50, max 100)
 *   - cursor: pagination cursor
 */
export async function getFeed(req: Request, res: Response) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

    // Get all game configs and ratings from DB
    const [gameConfigs, ratings] = await Promise.all([getCachedGameConfigs(), getRatingData()]);

    // Filter out beta games for non-authenticated users
    const visibleConfigs = gameConfigs.filter((g) => !g.betaOnly);

    const scored = computeFeedScores({
      gameConfigs: visibleConfigs,
      ratings,
      userRecentGames: [],
      isBetaTester: false,
    });

    const ordered = interleaveResults(scored);
    const limited = ordered.slice(0, limit);

    const scores: Record<string, number> = {};
    const reasons: Record<string, FeedReason> = {};
    limited.forEach((s) => {
      scores[s.gameId] = s.score;
      reasons[s.gameId] = s.reason;
    });

    res.json({
      orderedGameIds: limited.map((s) => s.gameId),
      scores,
      reasons,
      total: ordered.length,
    });
  } catch (err) {
    console.error("Feed error:", err);
    res.status(500).json({ error: "Failed to load feed data" });
  }
}

/**
 * GET /games/feed/personalized
 *
 * Returns a personalized feed for authenticated users.
 *
 * Query params:
 *   - limit: max games to return (default 50, max 100)
 *   - cursor: pagination cursor
 *   - clientRecentGames: comma-separated fallback from localStorage
 */
export async function getPersonalizedFeed(req: Request, res: Response) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = (req as any).user;
  const userId = user?.uid || user?.userId;
  const isBetaTester = Boolean(user?.betaTester);

  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const clientRecentParam = String(req.query.clientRecentGames || "");

    // Get all data from DB
    const [gameConfigs, ratings, dbRecentGames] = await Promise.all([
      getCachedGameConfigs(),
      getRatingData(),
      userId ? getUserRecentGames(userId) : Promise.resolve([]),
    ]);

    // Filter games based on beta access
    const visibleConfigs = isBetaTester ? gameConfigs : gameConfigs.filter((g) => !g.betaOnly);

    // Use DB data if available, otherwise fall back to client-provided data
    const clientRecentGames = clientRecentParam.split(",").filter(Boolean);
    const userRecentGames = dbRecentGames.length > 0 ? dbRecentGames : clientRecentGames;

    const scored = computeFeedScores({
      gameConfigs: visibleConfigs,
      ratings,
      userRecentGames,
      isBetaTester,
    });

    const ordered = interleaveResults(scored);
    const limited = ordered.slice(0, limit);

    const scores: Record<string, number> = {};
    const reasons: Record<string, FeedReason> = {};
    limited.forEach((s) => {
      scores[s.gameId] = s.score;
      reasons[s.gameId] = s.reason;
    });

    res.json({
      orderedGameIds: limited.map((s) => s.gameId),
      scores,
      reasons,
      total: ordered.length,
      userRecentGames,
    });
  } catch (err) {
    console.error("Personalized feed error:", err);
    res.status(500).json({ error: "Failed to load personalized feed data" });
  }
}
