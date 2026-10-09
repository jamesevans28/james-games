import { test, expect, vi } from "vitest";
import { createHost } from "../../platform/host";
import type { AudioKit, GameManifest } from "../../platform/sdk";
import { dailyRunFor, localDay } from "./dailyRules";

vi.mock("../../utils/analytics", () => ({ gaEvent: vi.fn(), trackGameStart: vi.fn() }));

const manifest = { id: "test-game", title: "Test", design: { w: 540, h: 960 } } as GameManifest;
const silent: AudioKit = { muted: true, beep() {}, ding() {}, thud() {}, pop() {}, play() {} };
const hostFor = (daily?: { day: string; seed: number }) =>
  createHost(manifest, { audio: silent, onGameOver: () => undefined, daily });
const draw = (rng: () => number) => Array.from({ length: 8 }, () => rng());

test("two players on the same day get the same spawn sequence (T11.3)", () => {
  const today = dailyRunFor(localDay());
  expect(today).toBeDefined();
  const tilly = hostFor(today);
  const harvey = hostFor(today);
  expect(tilly.daily).toEqual(today);
  expect(draw(tilly.rng())).toEqual(draw(harvey.rng()));
  // A restart asks for a fresh generator: the daily run starts the same way again.
  expect(draw(tilly.rng())).toEqual(draw(harvey.rng()));
  // An explicit seed still wins.
  expect(draw(tilly.rng(7))).toEqual(draw(hostFor().rng(7)));
});

test("other days and normal runs get different sequences", () => {
  const a = hostFor({ day: "2026-10-09", seed: 772954410 });
  const b = hostFor({ day: "2026-10-10", seed: 554698268 });
  expect(draw(a.rng())).not.toEqual(draw(b.rng()));
  const normal = hostFor();
  expect(normal.daily).toBeUndefined();
  expect(draw(normal.rng())).not.toEqual(draw(a.rng()));
});
