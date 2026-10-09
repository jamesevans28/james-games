import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ACHIEVEMENT_RULES,
  stickersForFriendship,
  stickersForRun,
  type RunFacts,
} from "./achievements.js";

/** A second run of test-game on Friday 9 October 2026 that earns nothing. */
const quiet: RunFacts = {
  gameId: "test-game",
  score: 10,
  today: "2026-10-09",
  totalPlays: 2,
  gamesTried: 1,
  beatBest: false,
  weekPlayDays: ["2026-10-09"],
  dailiesThisWeek: 0,
};

const none = new Set<string>();
const ids = (facts: Partial<RunFacts>, owned: ReadonlySet<string> = none) =>
  stickersForRun({ ...quiet, ...facts }, owned).map((s) => s.id);

test("a quiet run earns nothing", () => {
  expect(stickersForRun(quiet, none)).toEqual([]);
});

test("first play, only on the very first run", () => {
  expect(ids({ totalPlays: 1 })).toEqual(["first-play"]);
  expect(ids({ totalPlays: 3 })).toEqual([]);
});

test("beating your own best", () => {
  expect(ids({ beatBest: true })).toEqual(["beat-best"]);
});

test("five different games tried", () => {
  expect(ids({ gamesTried: 4 })).toEqual([]);
  expect(ids({ gamesTried: 5 })).toEqual(["five-games"]);
  expect(ids({ gamesTried: 9 })).toEqual(["five-games"]);
});

test("three days this week collects that week's sticker, and today always counts", () => {
  expect(ids({ weekPlayDays: ["2026-10-05", "2026-10-09"] })).toEqual([]);
  expect(ids({ weekPlayDays: ["2026-10-05", "2026-10-07"] })).toEqual(["week-2026-41"]);
  expect(stickersForRun({ ...quiet, weekPlayDays: ["2026-10-05", "2026-10-07"] }, none)).toEqual([
    { id: "week-2026-41", kind: "weekly" },
  ]);
  // Last week's Sunday is a different week.
  expect(ids({ weekPlayDays: ["2026-10-04", "2026-10-07"] })).toEqual([]);
  // Already collected this week, but a new week is a new sticker.
  expect(ids({ weekPlayDays: ["2026-10-05", "2026-10-07"] }, new Set(["week-2026-41"]))).toEqual(
    [],
  );
});

test("three daily challenges this week", () => {
  expect(ids({ dailiesThisWeek: 2 })).toEqual([]);
  expect(ids({ dailiesThisWeek: 3 })).toEqual(["daily-trio"]);
});

test("game-specific score stickers need that game and that score", () => {
  expect(ids({ gameId: "reflex-ring", score: 99 })).toEqual([]);
  expect(ids({ gameId: "reflex-ring", score: 100 })).toEqual(["reflex-ring-100"]);
  expect(ids({ gameId: "serpento", score: 20 })).toEqual(["serpento-20"]);
  expect(ids({ gameId: "snapadile", score: 50 })).toEqual(["snapadile-50"]);
  expect(ids({ gameId: "hoop-city", score: 50 })).toEqual(["hoop-city-50"]);
  expect(ids({ gameId: "serpento", score: 100 })).toEqual(["serpento-20"]);
  expect(ids({ gameId: "test-game", score: 5000 })).toEqual([]);
  expect(ids({ gameId: "reflex-ring", score: 500, onRemix: true })).toEqual([]);
  const gameSpecific = ACHIEVEMENT_RULES.filter((r) => r.kind === "score");
  expect(
    new Set(gameSpecific.map((r) => (r.kind === "score" ? r.gameId : ""))).size,
  ).toBeGreaterThanOrEqual(4);
});

test("one run can earn several, weekly first, each once, never ones you have", () => {
  const big: Partial<RunFacts> = {
    gameId: "reflex-ring",
    score: 150,
    totalPlays: 1,
    gamesTried: 5,
    weekPlayDays: ["2026-10-05", "2026-10-06"],
    dailiesThisWeek: 3,
  };
  expect(stickersForRun({ ...quiet, ...big }, none)).toEqual([
    { id: "week-2026-41", kind: "weekly" },
    { id: "first-play", kind: "achievement" },
    { id: "five-games", kind: "achievement" },
    { id: "daily-trio", kind: "achievement" },
    { id: "reflex-ring-100", kind: "achievement" },
  ]);
  expect(ids(big, new Set(["first-play", "daily-trio"]))).toEqual([
    "week-2026-41",
    "five-games",
    "reflex-ring-100",
  ]);
});

test("friend and supporter stickers never come from a run", () => {
  const everything: Partial<RunFacts> = {
    totalPlays: 1,
    beatBest: true,
    gamesTried: 50,
    dailiesThisWeek: 7,
  };
  expect(ids(everything)).not.toContain("friend-made");
  expect(ids(everything)).not.toContain("supporter");
});

test("a new friendship collects the friend sticker once", () => {
  expect(stickersForFriendship(none)).toEqual([{ id: "friend-made", kind: "achievement" }]);
  expect(stickersForFriendship(new Set(["friend-made"]))).toEqual([]);
});

test("rule ids are unique, and every one is in the player app's catalogue", () => {
  const ruleIds = ACHIEVEMENT_RULES.map((r) => r.id);
  expect(new Set(ruleIds).size).toBe(ruleIds.length);
  const catalogue = readFileSync(
    path.resolve(import.meta.dirname, "../../../player-web/src/config/stickers.ts"),
    "utf8",
  );
  for (const rule of ACHIEVEMENT_RULES) {
    if (rule.kind === "week-days") continue; // weekly ids are parsed, not listed
    expect(catalogue, rule.id).toContain(`"${rule.id}"`);
  }
});
