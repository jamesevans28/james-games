import { test, expect } from "vitest";
import {
  ACHIEVEMENTS,
  WEEKLY_ART,
  parseWeeklyStickerId,
  stickerBook,
  stickerMomentText,
  stickerInfo,
} from "./stickers";

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

test("achievement ids are unique and every one has art, a name and a hint", () => {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const a of ACHIEVEMENTS) {
    expect(a.art.src).toMatch(/^\/brand\/stickers\/[a-z-]+\.svg$/);
    expect(a.label.length).toBeGreaterThan(0);
    expect(a.hint.length).toBeGreaterThan(0);
  }
  expect(stickerInfo("first-play")).toMatchObject({ kind: "achievement", alt: "First game!" });
});

test("the sticker book shows locked achievements, hides secret ones, and sorts weeks", () => {
  const book = stickerBook(["week-2026-40", "first-play", "week-2027-01", "week-2026-41", "odd"]);
  expect(book.weekly).toEqual(["week-2027-01", "week-2026-41", "week-2026-40"]);
  const first = book.achievements.find((a) => a.id === "first-play");
  expect(first?.earned).toBe(true);
  expect(book.achievements.find((a) => a.id === "beat-best")?.earned).toBe(false);
  expect(book.achievements.some((a) => a.id === "supporter")).toBe(false);
  expect(stickerBook(["supporter"]).achievements.find((a) => a.id === "supporter")?.earned).toBe(
    true,
  );
});

test("the sticker moment names what you got", () => {
  expect(stickerMomentText([{ id: "week-2026-41", kind: "weekly" }])).toEqual({
    title: "You got this week's sticker!",
    detail: "You played on 3 days this week.",
  });
  expect(stickerMomentText([{ id: "first-play", kind: "achievement" }])).toEqual({
    title: "You got a sticker!",
    detail: "First game!",
  });
  expect(
    stickerMomentText([
      { id: "week-2026-41", kind: "weekly" },
      { id: "beat-best", kind: "achievement" },
    ]),
  ).toEqual({ title: "You got 2 stickers!", detail: "This week's sticker · Beat your best" });
});
