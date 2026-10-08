import { test, expect } from "vitest";
import { buildHomeSections, isNewGame, orderGames, PLAY_AGAIN_MAX } from "./homeSections";

const NOW = Date.parse("2026-10-09T12:00:00.000Z");
const g = (id: string, updatedAt: string, createdAt = "2025-11-01T00:00:00.000Z") => ({
  id,
  title: id,
  createdAt,
  updatedAt,
});

const games = [
  g("alpha", "2026-01-01T00:00:00.000Z"),
  g("bravo", "2026-03-01T00:00:00.000Z"),
  g("charlie", "2026-03-01T00:00:00.000Z"),
  g("delta", "2026-02-01T00:00:00.000Z"),
  g("echo", "2026-10-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z"),
];

test("recently played first, then most recently updated, then title", () => {
  const order = orderGames(games, ["delta", "alpha"]).map((x) => x.id);
  expect(order).toEqual(["delta", "alpha", "echo", "bravo", "charlie"]);
});

test("with nothing played it's by update date", () => {
  expect(orderGames(games, []).map((x) => x.id)).toEqual([
    "echo",
    "bravo",
    "charlie",
    "delta",
    "alpha",
  ]);
});

test("unknown ids in the history are ignored and the input isn't mutated", () => {
  const input = [...games];
  orderGames(input, ["gone", "bravo"]);
  expect(input).toEqual(games);
  expect(orderGames(input, ["gone", "bravo"])[0]?.id).toBe("bravo");
});

test("new means created in the last 30 days", () => {
  expect(isNewGame(g("x", "", "2026-09-20T00:00:00.000Z"), NOW)).toBe(true);
  expect(isNewGame(g("x", "", "2026-08-01T00:00:00.000Z"), NOW)).toBe(false);
  expect(isNewGame({ id: "x", title: "x" }, NOW)).toBe(false);
});

test("sections: new, play again (capped), all", () => {
  const recent = ["charlie", "nope", "alpha", "bravo", "delta", "echo"];
  const s = buildHomeSections(games, recent, NOW);
  expect(s.fresh.map((x) => x.id)).toEqual(["echo"]);
  expect(s.playAgain.map((x) => x.id)).toEqual(["charlie", "alpha", "bravo", "delta"]);
  expect(s.playAgain).toHaveLength(PLAY_AGAIN_MAX);
  expect(s.all).toHaveLength(games.length);
  expect(s.all[0]?.id).toBe("charlie");
});

test("a new device has no play again", () => {
  expect(buildHomeSections(games, [], NOW).playAgain).toEqual([]);
});
