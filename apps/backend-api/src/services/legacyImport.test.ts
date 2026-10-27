import { test, expect } from "vitest";
import { guestId, planImport, unmarshall, type LegacyUser } from "./legacyImport.js";

const HASH = "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234";
const games = [
  { id: "snapadile", maxScore: 1000 },
  { id: "serpento", maxScore: 500 },
];
const now = new Date("2026-10-27T00:00:00Z");

test("unmarshall reads DynamoDB's typed values", () => {
  expect(
    unmarshall({ a: { S: "x" }, b: { N: "12" }, c: { BOOL: true }, d: { NULL: true } }),
  ).toEqual({ a: "x", b: 12, c: true, d: null });
});

test("a PIN account comes across even with no scores, with its username lowercased", () => {
  const users: LegacyUser[] = [
    { userId: "p1", username: "Tilly_7", pinHash: HASH, screenName: "Tilly" },
  ];
  const plan = planImport(users, [], [], games, now);
  expect(plan.players).toHaveLength(1);
  expect(plan.players[0]).toMatchObject({
    kind: "pin",
    username: "tilly_7",
    pinHash: HASH,
    bests: [],
  });
});

test("a guest comes across only if it has a usable score", () => {
  const users: LegacyUser[] = [{ userId: "g1" }, { userId: "g2" }];
  const plan = planImport(
    users,
    [{ userId: "g1", gameId: "snapadile", score: 10 }],
    [],
    games,
    now,
  );
  expect(plan.players.map((p) => p.legacyId)).toEqual(["g1"]);
  expect(plan.players[0]!.kind).toBe("guest");
  expect(plan.skipped.accountsWithoutScores).toBe(1);
});

test("the best is the highest score, earliest if tied; plays count score rows only", () => {
  const users: LegacyUser[] = [{ userId: "g1" }];
  const plan = planImport(
    users,
    [
      { userId: "g1", gameId: "snapadile", score: 50, createdAt: "2026-01-03T00:00:00Z" },
      { userId: "g1", gameId: "snapadile", score: 80, createdAt: "2026-01-02T00:00:00Z" },
      { userId: "g1", gameId: "snapadile", score: 80, createdAt: "2026-01-04T00:00:00Z" },
    ],
    [{ userId: "g1", gameId: "snapadile", bestScore: 60, lastPlayedAt: "2026-01-01T00:00:00Z" }],
    games,
    now,
  );
  expect(plan.players[0]!.bests).toEqual([
    {
      gameId: "snapadile",
      score: 80,
      achievedAt: "2026-01-02T00:00:00.000Z",
      plays: 3,
      lastScore: 80,
      lastPlayedAt: "2026-01-04T00:00:00.000Z",
    },
  ]);
});

test("scores without an account, on unknown games or over the limit are left out", () => {
  const users: LegacyUser[] = [{ userId: "g1" }];
  const plan = planImport(
    users,
    [
      { gameId: "snapadile", score: 5 },
      { userId: "nobody", gameId: "snapadile", score: 5 },
      { userId: "g1", gameId: "reindeer-run", score: 5 },
      { userId: "g1", gameId: "serpento", score: 501 },
      { userId: "g1", gameId: "serpento", score: -1 },
      { userId: "g1", gameId: "serpento", score: 400 },
    ],
    [],
    games,
    now,
  );
  expect(plan.skipped).toMatchObject({
    scoresWithoutAccount: 2,
    scoresOnUnknownGames: 1,
    scoresOverLimit: 2,
  });
  expect(plan.players[0]!.bests.map((b) => b.score)).toEqual([400]);
});

test("gold or broken avatars become 1; a bad hash makes the account a guest", () => {
  const users: LegacyUser[] = [
    { userId: "a", avatar: 150, username: "abc", pinHash: "not-bcrypt" },
    { userId: "b", avatar: 42 },
  ];
  const scores = [
    { userId: "a", gameId: "snapadile", score: 1 },
    { userId: "b", gameId: "snapadile", score: 1 },
  ];
  const [a, b] = planImport(users, scores, [], games, now).players;
  expect(a).toMatchObject({ avatar: 1, kind: "guest", username: null, pinHash: null });
  expect(b!.avatar).toBe(42);
});

test("imported guests get a prefixed id", () => {
  expect(guestId("abc")).toBe("legacy-abc");
});
