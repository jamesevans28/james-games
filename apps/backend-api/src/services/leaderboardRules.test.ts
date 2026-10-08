import { test, expect } from "vitest";
import { leaderboardLimit, leaderboardScope } from "./leaderboardRules.js";

test("limit is a whole number from 1 to 50, default 10", () => {
  expect(leaderboardLimit(undefined)).toBe(10);
  expect(leaderboardLimit("abc")).toBe(10);
  expect(leaderboardLimit("0")).toBe(10);
  expect(leaderboardLimit("-4")).toBe(10);
  expect(leaderboardLimit("3")).toBe(3);
  expect(leaderboardLimit("7.9")).toBe(7);
  expect(leaderboardLimit("500")).toBe(50);
});

test("scope is following only when asked for", () => {
  expect(leaderboardScope("following")).toBe("following");
  expect(leaderboardScope("friends")).toBe("following");
  expect(leaderboardScope("overall")).toBe("overall");
  expect(leaderboardScope(undefined)).toBe("overall");
  expect(leaderboardScope(["following"])).toBe("overall");
});
