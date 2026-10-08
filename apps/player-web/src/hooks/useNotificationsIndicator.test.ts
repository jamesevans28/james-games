import { expect, test } from "vitest";
import { hasNewRequests } from "./useNotificationsIndicator";

test("lights up only for requests newer than the last visit", () => {
  const seen = Date.parse("2026-10-09T10:00:00Z");
  expect(hasNewRequests([], seen)).toBe(false);
  expect(hasNewRequests([{ createdAt: "2026-10-09T09:00:00Z" }], seen)).toBe(false);
  expect(hasNewRequests([{ createdAt: "2026-10-09T11:00:00Z" }], seen)).toBe(true);
  expect(hasNewRequests([{ createdAt: "not a date" }], 0)).toBe(false);
});
