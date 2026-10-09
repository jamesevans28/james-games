import { test, expect, afterEach } from "vitest";
import { setAdaptersForTests } from "../../../platform/adapters";
import { webAdapters, webStorage } from "../../../platform/adapters/web";
import {
  NAME_MAX,
  cleanPlayerName,
  outcomeLine,
  passAndPlayReducer,
  passAndPlayWinner,
  readPassAndPlay,
  writePassAndPlay,
  type PassAndPlayState,
} from "./passAndPlay";

test("higher score wins", () => {
  expect(passAndPlayWinner({ name: "Tilly", score: 12 }, { name: "Harvey", score: 9 })).toEqual({
    kind: "win",
    winner: 0,
    name: "Tilly",
  });
  expect(passAndPlayWinner({ name: "Tilly", score: 3 }, { name: "Harvey", score: 9 })).toEqual({
    kind: "win",
    winner: 1,
    name: "Harvey",
  });
});

test("same score is a draw", () => {
  const outcome = passAndPlayWinner({ name: "A", score: 0 }, { name: "B", score: 0 });
  expect(outcome).toEqual({ kind: "draw" });
  expect(outcomeLine(outcome)).toBe("It’s a draw!");
  expect(outcomeLine({ kind: "win", winner: 1, name: "Harvey" })).toBe("Harvey wins!");
});

test("names are trimmed, squashed and capped, blanks fall back", () => {
  expect(cleanPlayerName("  Tilly   Bee ", "P1")).toBe("Tilly Bee");
  expect(cleanPlayerName("   ", "P1")).toBe("P1");
  expect(cleanPlayerName("a\u0007b", "P1")).toBe("ab");
  expect(cleanPlayerName("x".repeat(40), "P1")).toHaveLength(NAME_MAX);
});

test("two turns, a hand-off between them, then the result", () => {
  let s = passAndPlayReducer(null, { type: "start", setup: { on: true, names: ["Tilly", ""] } });
  expect(s).toEqual({ names: ["Tilly", "Player 2"], turn: 0, scores: [null, null], stage: "turn" });
  s = passAndPlayReducer(s, { type: "finish", score: 10 });
  expect(s?.stage).toBe("handoff");
  // A stray second game over during the hand-off is ignored.
  s = passAndPlayReducer(s, { type: "finish", score: 99 });
  expect(s?.scores).toEqual([10, null]);
  s = passAndPlayReducer(s, { type: "next" });
  expect(s).toMatchObject({ turn: 1, stage: "turn" });
  s = passAndPlayReducer(s, { type: "finish", score: 7 });
  expect(s).toMatchObject({ scores: [10, 7], stage: "result" });
  s = passAndPlayReducer(s, { type: "again" });
  expect(s).toMatchObject({ turn: 0, scores: [null, null], stage: "turn" });
  expect(passAndPlayReducer(s, { type: "stop" })).toBeNull();
});

test("start with the toggle off is a normal one-player game", () => {
  const prev: PassAndPlayState = {
    names: ["a", "b"],
    turn: 1,
    scores: [1, null],
    stage: "turn",
  };
  expect(
    passAndPlayReducer(prev, { type: "start", setup: { on: false, names: ["a", "b"] } }),
  ).toBeNull();
  expect(passAndPlayReducer(null, { type: "start", setup: null })).toBeNull();
});

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

afterEach(() => setAdaptersForTests(null));

test("setup round-trips through session storage, and junk reads as off", () => {
  const mem = new MemoryStorage();
  setAdaptersForTests({ ...webAdapters, session: webStorage(() => mem as unknown as Storage) });
  expect(readPassAndPlay()).toEqual({ on: false, names: ["", ""] });
  writePassAndPlay({ on: true, names: ["Tilly", "Harvey"] });
  expect(readPassAndPlay()).toEqual({ on: true, names: ["Tilly", "Harvey"] });
  mem.setItem("g4j:passAndPlay", "{nope");
  expect(readPassAndPlay()).toEqual({ on: false, names: ["", ""] });
});
