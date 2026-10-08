import { getGame } from "../repos/gamesRepo.js";
import { aggregateRatings, getUserStars, upsertRating } from "../repos/ratingsRepo.js";
import { getUserById } from "../repos/usersRepo.js";

/** Star ratings: 1–5, one per player per game. Summaries are live SQL aggregates. */

export type RatingSummary = {
  gameId: string;
  ratingCount: number;
  avgRating: number;
  userRating?: number;
};

export const MAX_SUMMARY_IDS = 100;

/** Whole stars 1–5, or null when the input isn't a usable rating. */
export function parseStars(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return Math.round(n);
}

export async function getRatingSummaries(gameIds: string[]): Promise<RatingSummary[]> {
  const unique = Array.from(new Set(gameIds)).slice(0, MAX_SUMMARY_IDS);
  const found = new Map((await aggregateRatings(unique)).map((r) => [r.gameId, r]));
  return unique.map((gameId) => ({
    gameId,
    ratingCount: found.get(gameId)?.ratingCount ?? 0,
    avgRating: found.get(gameId)?.avgRating ?? 0,
  }));
}

/** The summary, plus the viewer's own stars when they have rated. */
export async function getRatingSummary(gameId: string, viewerId?: string): Promise<RatingSummary> {
  const [summary] = await getRatingSummaries([gameId]);
  const result: RatingSummary = summary ?? { gameId, ratingCount: 0, avgRating: 0 };
  if (viewerId) {
    const stars = await getUserStars(viewerId, gameId);
    if (stars !== null) result.userRating = stars;
  }
  return result;
}

export type RateResult =
  { ok: true; summary: RatingSummary } | { ok: false; status: 400 | 404; error: string };

export async function rateGame(
  userId: string,
  gameId: string,
  rating: unknown,
): Promise<RateResult> {
  const stars = parseStars(rating);
  if (stars === null) return { ok: false, status: 400, error: "invalid_rating" };
  const [game, user] = await Promise.all([getGame(gameId), getUserById(userId)]);
  if (!game || game.status === "inactive") {
    return { ok: false, status: 404, error: "game_not_found" };
  }
  if (!user) return { ok: false, status: 404, error: "user_not_found" };
  await upsertRating(userId, gameId, stars);
  return { ok: true, summary: await getRatingSummary(gameId, userId) };
}
