import { test, expect } from "vitest";
import { mulberry32 } from "../../../platform/rng";
import {
  BASE_FIRE_MS,
  fireIntervalMs,
  formation,
  FORMATION_SPACING,
  hitAlien,
  hitsSide,
  pickIndex,
  POINTS_PER_ALIEN,
  POWERUP_COOLDOWN_MS,
  powerupUnlocks,
  rollPowerup,
  shotOffsets,
  waveFor,
} from "./rules";

test("wave 1 is calm: no shooting, no strong aliens", () => {
  expect(waveFor(1)).toEqual({
    rows: 4,
    cols: 8,
    strongRows: 0,
    strongHealth: 2,
    speed: 15.6,
    fireDelayMs: null,
  });
});

test("waves get tougher, then hold", () => {
  expect(waveFor(2).fireDelayMs).toBe(8000);
  expect(waveFor(3)).toMatchObject({ strongRows: 1, fireDelayMs: 6000 });
  expect(waveFor(4)).toMatchObject({ strongRows: 2, strongHealth: 2, fireDelayMs: 4000 });
  expect(waveFor(6)).toMatchObject({ strongRows: 2, strongHealth: 3, fireDelayMs: 3000 });
  expect(waveFor(7).speed).toBeCloseTo(34.32);
  expect(waveFor(50)).toEqual(waveFor(7));
});

test("difficulty never goes backwards", () => {
  let prev = waveFor(1);
  for (let level = 2; level <= 30; level++) {
    const next = waveFor(level);
    expect(next.speed).toBeGreaterThanOrEqual(prev.speed);
    expect(next.strongRows).toBeGreaterThanOrEqual(prev.strongRows);
    expect(next.strongHealth).toBeGreaterThanOrEqual(prev.strongHealth);
    expect(next.fireDelayMs ?? Infinity).toBeLessThanOrEqual(prev.fireDelayMs ?? Infinity);
    prev = next;
  }
});

test("bad levels are treated as wave 1", () => {
  expect(waveFor(0)).toEqual(waveFor(1));
  expect(waveFor(-3)).toEqual(waveFor(1));
});

test("formation is a centred grid with strong rows on top", () => {
  const slots = formation(waveFor(4), 540, 170);
  expect(slots).toHaveLength(32);
  const xs = slots.map((s) => s.x);
  expect(Math.min(...xs)).toBe(60);
  expect(Math.max(...xs)).toBe(480);
  expect(slots[0]).toEqual({ x: 60, y: 170, row: 0, strong: true, health: 2 });
  expect(slots.at(-1)).toEqual({
    x: 480,
    y: 170 + 3 * FORMATION_SPACING,
    row: 3,
    strong: false,
    health: 1,
  });
  expect(slots.filter((s) => s.strong)).toHaveLength(16);
});

test("the formation turns at either side", () => {
  expect(hitsSide([100, 200], 5, 40, 500)).toBe(false);
  expect(hitsSide([100, 497], 5, 40, 500)).toBe(true);
  expect(hitsSide([43, 200], -5, 40, 500)).toBe(true);
  expect(hitsSide([], 5, 40, 500)).toBe(false);
});

test("an alien scores only when its last hit lands", () => {
  expect(hitAlien(1)).toEqual({ health: 0, destroyed: true, points: POINTS_PER_ALIEN });
  expect(hitAlien(3)).toEqual({ health: 2, destroyed: false, points: 0 });
  expect(hitAlien(0)).toEqual({ health: 0, destroyed: true, points: POINTS_PER_ALIEN });
});

test("power-ups unlock wave by wave", () => {
  expect(powerupUnlocks(1)).toEqual([]);
  expect(powerupUnlocks(2)).toEqual(["doubleBullet"]);
  expect(powerupUnlocks(3)).toEqual(["doubleBullet", "rapidFire"]);
  expect(powerupUnlocks(4)).toEqual(["doubleBullet", "rapidFire", "shield"]);
  expect(powerupUnlocks(20)).toEqual(powerupUnlocks(4));
});

test("power-up drops respect unlocks, cooldown and chance", () => {
  const always = () => 0;
  const never = () => 0.99;
  expect(rollPowerup(1, Infinity, always)).toBeNull();
  expect(rollPowerup(4, POWERUP_COOLDOWN_MS - 1, always)).toBeNull();
  expect(rollPowerup(4, POWERUP_COOLDOWN_MS, never)).toBeNull();
  expect(rollPowerup(2, POWERUP_COOLDOWN_MS, always)).toBe("doubleBullet");
});

test("power-up drops are repeatable by seed and only offer unlocked types", () => {
  const seq = (seed: number) => {
    const rng = mulberry32(seed);
    return Array.from({ length: 40 }, () => rollPowerup(3, Infinity, rng));
  };
  expect(seq(7)).toEqual(seq(7));
  const drops = seq(7).filter((d) => d !== null);
  expect(drops.length).toBeGreaterThan(0);
  expect(drops.every((d) => d === "doubleBullet" || d === "rapidFire")).toBe(true);
});

test("firing", () => {
  expect(fireIntervalMs(false)).toBe(BASE_FIRE_MS);
  expect(fireIntervalMs(true)).toBe(BASE_FIRE_MS / 2);
  expect(shotOffsets(false)).toEqual([0]);
  expect(shotOffsets(true)).toEqual([-15, 15]);
});

test("pickIndex stays in range", () => {
  expect(pickIndex(0, () => 0.5)).toBe(-1);
  expect(pickIndex(4, () => 0)).toBe(0);
  expect(pickIndex(4, () => 0.999999)).toBe(3);
  expect(pickIndex(4, () => 1)).toBe(3);
});
