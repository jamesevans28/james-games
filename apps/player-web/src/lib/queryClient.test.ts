import { test, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateAfterRun, queryKeys } from "./queryClient";

test("a finished run invalidates that game's boards and ratings, the profile and me", () => {
  const client = new QueryClient();
  const keys = [
    [...queryKeys.leaderboard("hoop-city"), "overall", 5],
    [...queryKeys.leaderboard("serpento"), "overall", 5],
    [...queryKeys.ratings("hoop-city"), "anon"],
    [...queryKeys.profile("u1")],
    [...queryKeys.me],
    [...queryKeys.catalog],
  ];
  for (const key of keys) client.setQueryData(key, 1);

  invalidateAfterRun("hoop-city", client);

  const stale = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
  expect(stale(keys[0]!)).toBe(true);
  expect(stale(keys[1]!)).toBe(false);
  expect(stale(keys[2]!)).toBe(true);
  expect(stale(keys[3]!)).toBe(true);
  expect(stale(keys[4]!)).toBe(true);
  expect(stale(keys[5]!)).toBe(false);
});
