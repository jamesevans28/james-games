import { test, expect } from "vitest";
import { WEEKLY_ART, parseWeeklyStickerId, stickerInfo } from "./stickers";

test("weekly ids parse into ISO year and week", () => {
  expect(parseWeeklyStickerId("week-2026-41")).toEqual({ isoYear: 2026, isoWeek: 41 });
  expect(parseWeeklyStickerId("week-2027-01")).toEqual({ isoYear: 2027, isoWeek: 1 });
  expect(parseWeeklyStickerId("week-2026-54")).toBeNull();
  expect(parseWeeklyStickerId("week-2026-00")).toBeNull();
  expect(parseWeeklyStickerId("week-26-4")).toBeNull();
  expect(parseWeeklyStickerId("trophy")).toBeNull();
});

test("weekly art rotates by week number", () => {
  const ids = [40, 41, 42, 43, 44].map((w) => stickerInfo(`week-2026-${w}`).src);
  expect(new Set(ids.slice(0, 4)).size).toBe(WEEKLY_ART.length);
  expect(ids[4]).toBe(ids[0]);
  expect(stickerInfo("week-2026-41")).toMatchObject({
    kind: "weekly",
    alt: "Rainbow sticker for week 41 of 2026",
  });
});

test("unknown ids still render with plain alt text", () => {
  expect(stickerInfo("mystery")).toMatchObject({ kind: "unknown", alt: "A sticker" });
  expect(stickerInfo("mystery").src).toBe(WEEKLY_ART[0]!.src);
});
