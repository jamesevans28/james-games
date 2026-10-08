/**
 * When to ask for a rating (T7.4): on the game's landing page, once you've played it
 * at least 3 times, and at most once per game every 30 days. Never in the middle of
 * a replay loop (the landing page only asks when you arrive, not when a run ends).
 *
 * State lives on this device under STORAGE_KEYS.ratingPrompt as
 * `{ [gameId]: { plays, lastPromptAt } }`.
 */
import { readStored, STORAGE_KEYS } from "../utils/storageKeys";

export const PROMPT_AFTER_PLAYS = 3;
export const PROMPT_EVERY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RatingPromptState = { plays: number; lastPromptAt: number | null };

export function shouldPromptRating({
  plays,
  lastPromptAt,
  now,
}: RatingPromptState & { now: number }): boolean {
  if (plays < PROMPT_AFTER_PLAYS) return false;
  if (lastPromptAt === null) return true;
  return now - lastPromptAt >= PROMPT_EVERY_DAYS * DAY_MS;
}

type Stored = Record<string, Partial<RatingPromptState>>;

function readAll(): Stored {
  try {
    const raw = readStored("ratingPrompt");
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Stored): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ratingPrompt, JSON.stringify(all));
  } catch {
    // storage full or blocked: the prompt just won't be remembered
  }
}

export function readRatingPromptState(gameId: string): RatingPromptState {
  const entry = readAll()[gameId];
  const plays = typeof entry?.plays === "number" && entry.plays > 0 ? Math.floor(entry.plays) : 0;
  const last = entry?.lastPromptAt;
  return { plays, lastPromptAt: typeof last === "number" && Number.isFinite(last) ? last : null };
}

/** Counts a finished run of `gameId`. Returns the new play count. */
export function recordPlay(gameId: string): number {
  const all = readAll();
  const current = readRatingPromptState(gameId);
  const plays = current.plays + 1;
  all[gameId] = { ...current, plays };
  writeAll(all);
  return plays;
}

/** Remembers that the prompt was shown for `gameId` at `now`. */
export function markPrompted(gameId: string, now: number): void {
  const all = readAll();
  all[gameId] = { ...readRatingPromptState(gameId), lastPromptAt: now };
  writeAll(all);
}
