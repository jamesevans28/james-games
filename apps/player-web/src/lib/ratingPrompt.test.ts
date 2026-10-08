import { test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  markPrompted,
  readRatingPromptState,
  recordPlay,
  shouldPromptRating,
} from "./ratingPrompt";
import { STORAGE_KEYS } from "../utils/storageKeys";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-09T12:00:00.000Z");

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

test("not before the 3rd play", () => {
  expect(shouldPromptRating({ plays: 0, lastPromptAt: null, now: NOW })).toBe(false);
  expect(shouldPromptRating({ plays: 2, lastPromptAt: null, now: NOW })).toBe(false);
  expect(shouldPromptRating({ plays: 3, lastPromptAt: null, now: NOW })).toBe(true);
  expect(shouldPromptRating({ plays: 40, lastPromptAt: null, now: NOW })).toBe(true);
});

test("at most once every 30 days per game", () => {
  expect(shouldPromptRating({ plays: 5, lastPromptAt: NOW - DAY, now: NOW })).toBe(false);
  expect(shouldPromptRating({ plays: 5, lastPromptAt: NOW - 29 * DAY, now: NOW })).toBe(false);
  expect(shouldPromptRating({ plays: 5, lastPromptAt: NOW - 30 * DAY, now: NOW })).toBe(true);
});

test("plays and prompts are counted per game", () => {
  recordPlay("hoop-city");
  recordPlay("hoop-city");
  expect(recordPlay("hoop-city")).toBe(3);
  expect(readRatingPromptState("serpento")).toEqual({ plays: 0, lastPromptAt: null });

  markPrompted("hoop-city", NOW);
  expect(readRatingPromptState("hoop-city")).toEqual({ plays: 3, lastPromptAt: NOW });
  recordPlay("hoop-city");
  expect(readRatingPromptState("hoop-city")).toEqual({ plays: 4, lastPromptAt: NOW });
  expect(localStorage.getItem(STORAGE_KEYS.ratingPrompt)).toContain("hoop-city");
});

test("bad stored data reads as nothing, and storage errors never throw", () => {
  localStorage.setItem(STORAGE_KEYS.ratingPrompt, "not json");
  expect(readRatingPromptState("x")).toEqual({ plays: 0, lastPromptAt: null });
  localStorage.setItem(STORAGE_KEYS.ratingPrompt, JSON.stringify({ x: { plays: "lots" } }));
  expect(readRatingPromptState("x").plays).toBe(0);
  vi.stubGlobal("localStorage", undefined);
  expect(() => recordPlay("x")).not.toThrow();
  expect(() => markPrompted("x", NOW)).not.toThrow();
});
