import { test, expect, vi, beforeEach } from "vitest";
import { createHost, type RunResult } from "./host";
import type { AudioKit, GameManifest } from "./sdk";

vi.mock("../utils/analytics", () => ({ gaEvent: vi.fn(), trackGameStart: vi.fn() }));

const manifest = { id: "test-game", title: "Test", design: { w: 540, h: 960 } } as GameManifest;
const silent: AudioKit = { muted: true, beep() {}, ding() {}, thud() {}, pop() {}, play() {} };

let clock = 0;
let results: RunResult[] = [];
const make = () =>
  createHost(manifest, { now: () => clock, audio: silent, onGameOver: (r) => results.push(r) });

beforeEach(() => {
  clock = 1000;
  results = [];
  localStorage.clear();
});

test("rng is deterministic for a seed", () => {
  const host = make();
  const a = host.rng(123);
  const b = host.rng(123);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

test("game over reports the score and the run's duration", () => {
  const host = make();
  host.beginRun();
  clock += 4_500;
  host.gameOver({ score: 42.7 });
  expect(results).toEqual([{ score: 42, durationMs: 4_500 }]);
});

test("only the first game over of a run counts", () => {
  const host = make();
  host.beginRun();
  host.gameOver({ score: 5 });
  host.gameOver({ score: 9 });
  expect(results).toHaveLength(1);
  host.beginRun();
  host.gameOver({ score: 9 });
  expect(results.map((r) => r.score)).toEqual([5, 9]);
});

test("paused time is not counted", () => {
  const host = make();
  host.beginRun();
  clock += 1_000;
  host.setPaused(true);
  expect(host.isPaused()).toBe(true);
  clock += 60_000;
  host.setPaused(false);
  clock += 2_000;
  host.gameOver({ score: 1 });
  expect(results[0]?.durationMs).toBe(3_000);
});

test("game over saves a new best and never lowers it", () => {
  const host = make();
  host.beginRun();
  host.gameOver({ score: 30 });
  expect(host.best.get()).toBe(30);
  host.beginRun();
  host.gameOver({ score: 10 });
  expect(host.best.get()).toBe(30);
});

test("junk scores become 0", () => {
  const host = make();
  host.beginRun();
  host.gameOver({ score: Number.NaN });
  expect(results[0]?.score).toBe(0);
});
