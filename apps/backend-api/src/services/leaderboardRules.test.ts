import { test } from "vitest";
import assert from "node:assert/strict";
import { bestPerUser } from "./leaderboardRules.js";

const allowed = new Set(["me", "friend", "far-friend"]);

test("keeps one best row per friend and ignores strangers", () => {
  const rows = [
    { userId: "stranger", score: 999, createdAt: "2026-01-01" },
    { userId: "friend", score: 50, createdAt: "2026-01-02" },
    { userId: "friend", score: 80, createdAt: "2026-01-03" },
    { userId: "me", score: 60, createdAt: "2026-01-01" },
  ];
  assert.deepEqual(
    bestPerUser(rows, [], allowed).map((r) => [r.userId, r.score]),
    [
      ["friend", 80],
      ["me", 60],
    ],
  );
});

test("includes a friend who is outside the global top list via their stats row", () => {
  const out = bestPerUser(
    [],
    [{ userId: "far-friend", bestScore: 12, lastPlayedAt: "2026-02-01" }],
    allowed,
  );
  assert.deepEqual(out, [{ userId: "far-friend", score: 12, createdAt: "2026-02-01" }]);
});

test("takes the higher of a score row and a stats row for the same friend", () => {
  const rows = [{ userId: "friend", score: 40, createdAt: "2026-01-01" }];
  const stats = [{ userId: "friend", bestScore: 70, lastPlayedAt: "2026-03-01" }];
  assert.equal(bestPerUser(rows, stats, allowed)[0].score, 70);
});

test("ties go to whoever got there first", () => {
  const rows = [
    { userId: "friend", score: 10, createdAt: "2026-01-05" },
    { userId: "me", score: 10, createdAt: "2026-01-01" },
  ];
  assert.deepEqual(
    bestPerUser(rows, [], allowed).map((r) => r.userId),
    ["me", "friend"],
  );
});
