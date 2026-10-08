import { expect, test } from "vitest";
import { lastUtcDays } from "./adminMetricsService.js";

test("lastUtcDays lists UTC days oldest first, ending today", () => {
  expect(lastUtcDays(new Date("2026-03-02T23:30:00Z"), 3)).toEqual([
    "2026-02-28",
    "2026-03-01",
    "2026-03-02",
  ]);
});
