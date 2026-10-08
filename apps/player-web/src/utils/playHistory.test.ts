import { test, beforeEach, expect } from "vitest";
import { getLastPlayedGames, recordGamePlayed } from "./playHistory";

beforeEach(() => localStorage.clear());

test("starts empty", () => expect(getLastPlayedGames()).toEqual([]));

test("newest first, no duplicates", () => {
  recordGamePlayed("snapadile");
  recordGamePlayed("hoop-city");
  recordGamePlayed("snapadile");
  expect(getLastPlayedGames()).toEqual(["snapadile", "hoop-city"]);
});

test("keeps only the last 10", () => {
  for (let i = 0; i < 12; i++) recordGamePlayed(`game-${i}`);
  const games = getLastPlayedGames();
  expect(games).toHaveLength(10);
  expect(games[0]).toBe("game-11");
});

test("ignores corrupt or foreign values", () => {
  localStorage.setItem("g4j:lastPlayed", "{not json");
  expect(getLastPlayedGames()).toEqual([]);
  localStorage.setItem("g4j:lastPlayed", JSON.stringify(["ok", 3, null]));
  expect(getLastPlayedGames()).toEqual(["ok"]);
});

test("reads the flingo-era key once and moves it", () => {
  localStorage.setItem("flingo_last_played_games", JSON.stringify(["blocker"]));
  expect(getLastPlayedGames()).toEqual(["blocker"]);
  expect(localStorage.getItem("flingo_last_played_games")).toBeNull();
});
