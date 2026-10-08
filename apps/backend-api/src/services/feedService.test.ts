import { describe, expect, test } from "vitest";
import type { FeedRankRow } from "../repos/gamesRepo.js";
import { clampFeedLimit, orderFeed } from "./feedService.js";

function row(gameId: string, extra: Partial<FeedRankRow> = {}): FeedRankRow {
  return {
    gameId,
    status: "active",
    featured: false,
    recentPlays: 0,
    avgRating: 0,
    ratingCount: 0,
    ...extra,
  };
}

const ranked = [
  row("star", { featured: true }),
  row("a"),
  row("b"),
  row("beta", { status: "beta" }),
  row("c"),
  row("d"),
];

describe("orderFeed", () => {
  test("keeps rank order, featured first, beta hidden unless allowed", () => {
    expect(orderFeed(ranked, { includeBeta: false })).toEqual([
      { gameId: "star", reason: "featured" },
      { gameId: "a", reason: "popular" },
      { gameId: "b", reason: "popular" },
      { gameId: "c", reason: "popular" },
      { gameId: "d", reason: "popular" },
    ]);
    expect(orderFeed(ranked, { includeBeta: true }).map((e) => e.gameId)).toEqual([
      "star",
      "beta",
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  test("alternates unplayed (by rank) with played (most recent first)", () => {
    const entries = orderFeed(ranked, { includeBeta: false, played: ["c", "a", "gone"] });
    expect(entries).toEqual([
      { gameId: "star", reason: "featured" },
      { gameId: "b", reason: "popular" },
      { gameId: "c", reason: "user_recent" },
      { gameId: "d", reason: "popular" },
      { gameId: "a", reason: "user_recent" },
    ]);
  });
});

test("clampFeedLimit", () => {
  expect(clampFeedLimit(undefined)).toBe(50);
  expect(clampFeedLimit("0")).toBe(50);
  expect(clampFeedLimit("7")).toBe(7);
  expect(clampFeedLimit("500")).toBe(100);
});
