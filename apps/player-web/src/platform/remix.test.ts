import { test, expect, vi, beforeEach } from "vitest";
import {
  clampKnob,
  defaultValues,
  formatKnob,
  isDefault,
  remixBestId,
  remixValue,
  resolveValues,
  sameValues,
} from "./remix";
import { createHost } from "./host";
import { allManifests } from "./registry";
import type { AudioKit, GameManifest, RemixKnob } from "./sdk";
import { getBest } from "./storage/bestScore";

vi.mock("../utils/analytics", () => ({ gaEvent: vi.fn(), trackGameStart: vi.fn() }));

const speed: RemixKnob = {
  key: "speed",
  label: "Speed",
  min: 0.5,
  max: 2.5,
  step: 0.25,
  default: 1,
};
const lives: RemixKnob = { key: "lives", label: "Lives", min: 1, max: 5, step: 1, default: 3 };
const knobs = [speed, lives];

beforeEach(() => localStorage.clear());

test("clampKnob keeps values in range and on the step grid", () => {
  expect(clampKnob(speed, 1.6)).toBe(1.5);
  expect(clampKnob(speed, 9)).toBe(2.5);
  expect(clampKnob(speed, -1)).toBe(0.5);
  expect(clampKnob(speed, Number.NaN)).toBe(1);
  expect(clampKnob({ ...lives, min: 0.6, max: 1.4, step: 0.1, default: 1 }, 0.7)).toBe(0.7);
});

test("resolveValues fills defaults and drops unknown keys", () => {
  expect(defaultValues(knobs)).toEqual({ speed: 1, lives: 3 });
  expect(resolveValues(knobs, { speed: 2, other: 5 })).toEqual({ speed: 2, lives: 3 });
  expect(resolveValues(knobs, null)).toEqual({ speed: 1, lives: 3 });
  expect(resolveValues(knobs, { lives: "lots" })).toEqual({ speed: 1, lives: 3 });
});

test("isDefault and sameValues compare resolved values", () => {
  expect(isDefault(knobs, {})).toBe(true);
  expect(isDefault(knobs, { speed: 1, lives: 3 })).toBe(true);
  expect(isDefault(knobs, { speed: 2 })).toBe(false);
  expect(sameValues(knobs, { speed: 2 }, { speed: 2, lives: 3 })).toBe(true);
  expect(sameValues(knobs, { speed: 2 }, { speed: 2.25 })).toBe(false);
});

test("remixValue reads the remix, else the default, and 1 for an unknown key", () => {
  expect(remixValue(knobs, { speed: 2 }, "speed")).toBe(2);
  expect(remixValue(knobs, { speed: 2 }, "lives")).toBe(3);
  expect(remixValue(knobs, undefined, "speed")).toBe(1);
  expect(remixValue(knobs, { gravity: 3 }, "gravity")).toBe(1);
});

test("formatKnob shows multipliers with ×", () => {
  expect(formatKnob(speed, 1.5)).toBe("1.5×");
  expect(formatKnob(lives, 4)).toBe("4");
});

test("remix bests are stored apart from the game's best", () => {
  expect(remixBestId("snapadile", "abc")).toBe("snapadile~remix-abc");
  expect(remixBestId("snapadile", null)).toBe("snapadile~remix");
});

const silent: AudioKit = { muted: true, beep() {}, ding() {}, thud() {}, pop() {}, play() {} };
const manifest = {
  id: "test-game",
  title: "Test",
  design: { w: 540, h: 960 },
  remix: knobs,
} as GameManifest;

test("the host serves remix values and keeps a remix best apart", () => {
  const normal = createHost(manifest, { audio: silent, onGameOver: () => {} });
  expect(normal.remix.get("speed")).toBe(1);
  expect(normal.remix.get("lives")).toBe(3);

  const remixed = createHost(manifest, {
    audio: silent,
    onGameOver: () => {},
    remix: { speed: 2.5, lives: 99 },
    bestId: remixBestId("test-game", "r1"),
  });
  expect(remixed.remix.get("speed")).toBe(2.5);
  expect(remixed.remix.get("lives")).toBe(5);
  remixed.beginRun();
  remixed.gameOver({ score: 40 });
  expect(getBest("test-game")).toBe(0);
  expect(getBest("test-game~remix-r1")).toBe(40);
  expect(remixed.best.get()).toBe(40);
});

test("every manifest's remix knobs are sane: unique keys, default on the grid", () => {
  for (const m of allManifests) {
    const list = m.remix ?? [];
    expect(new Set(list.map((k) => k.key)).size, m.id).toBe(list.length);
    for (const k of list) {
      expect(k.min, `${m.id}.${k.key}`).toBeLessThan(k.max);
      expect(clampKnob(k, k.default), `${m.id}.${k.key} default`).toBe(k.default);
      expect(clampKnob(k, k.min), `${m.id}.${k.key} min`).toBe(k.min);
      expect(clampKnob(k, k.max), `${m.id}.${k.key} max`).toBe(k.max);
    }
  }
  const remixable = allManifests.filter((m) => m.remix?.length).map((m) => m.id);
  expect(remixable).toEqual(expect.arrayContaining(["snapadile", "hoop-city", "blocker"]));
});
