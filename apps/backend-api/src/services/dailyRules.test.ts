import { test, expect } from "vitest";
import { dailyGameFor, dailySeedFor, isoWeekBounds } from "./dailyRules.js";

const GAMES = ["serpento", "blocker", "reflex-ring", "snapadile", "hoop-city"];

function daysFrom(start: string, count: number): string[] {
  const t = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(t + i * 86_400_000).toISOString().slice(0, 10),
  );
}

test("the daily seed is fixed per day (the player app pins the same values)", () => {
  expect(dailySeedFor("2026-10-09")).toBe(772954410);
  expect(dailySeedFor("2026-10-10")).toBe(554698268);
  expect(dailySeedFor("2026-10-09")).toBe(dailySeedFor("2026-10-09"));
  expect(Number.isInteger(dailySeedFor("2027-01-01"))).toBe(true);
  expect(dailySeedFor("2027-01-01")).toBeGreaterThanOrEqual(0);
});

test("the daily game is the same for everyone, whatever order the ids come in", () => {
  for (const day of daysFrom("2026-10-01", 30)) {
    const a = dailyGameFor(day, GAMES);
    expect(GAMES).toContain(a);
    expect(dailyGameFor(day, [...GAMES].reverse())).toBe(a);
    expect(dailyGameFor(day, [...GAMES, ...GAMES])).toBe(a);
  }
  // Pinned so the player app's mirror can be checked against it.
  expect(
    ["2026-10-09", "2026-10-10", "2026-10-11"].map((d) => dailyGameFor(d, ["a", "b", "c"])),
  ).toEqual(["c", "b", "c"]);
});

test("every game gets a turn in each block of days, with no game twice in a row", () => {
  const sorted = [...GAMES].sort();
  // Blocks start where days-since-epoch is a multiple of the game count.
  const firstBlockDay = Math.ceil(Date.parse("2026-10-01T00:00:00Z") / 86_400_000 / 5) * 5;
  const start = new Date(firstBlockDay * 86_400_000).toISOString().slice(0, 10);
  const picks = daysFrom(start, 50).map((d) => dailyGameFor(d, GAMES));
  for (let block = 0; block < 10; block++) {
    expect([...picks.slice(block * 5, block * 5 + 5)].sort()).toEqual(sorted);
  }
  for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
});

test("no games, no daily game; one game, always that one", () => {
  expect(dailyGameFor("2026-10-09", [])).toBeNull();
  expect(dailyGameFor("2026-10-09", ["solo"])).toBe("solo");
  expect(dailyGameFor("2026-10-10", ["solo"])).toBe("solo");
});

test("ISO week bounds run Monday to Sunday", () => {
  expect(isoWeekBounds("2026-10-09")).toEqual({ monday: "2026-10-05", sunday: "2026-10-11" });
  expect(isoWeekBounds("2026-10-05")).toEqual({ monday: "2026-10-05", sunday: "2026-10-11" });
  expect(isoWeekBounds("2026-10-11")).toEqual({ monday: "2026-10-05", sunday: "2026-10-11" });
  expect(isoWeekBounds("2027-01-01")).toEqual({ monday: "2026-12-28", sunday: "2027-01-03" });
});
