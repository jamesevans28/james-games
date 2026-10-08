import { test, expect } from "vitest";
import { mulberry32 } from "../../../platform/rng";
import { idx, type Grid } from "./grid";
import {
  collectPickup,
  coveragePct,
  enemySpeedFactor,
  isLevelComplete,
  levelSettings,
  loseLife,
  MAX_LIVES,
  newPowerupClock,
  nextPickupDelay,
  pickPickupCell,
  PICKUP_DELAY_MAX_MS,
  PICKUP_DELAY_MIN_MS,
  PICKUP_LIFETIME_MS,
  skipPickup,
  SLOW_FACTOR,
  SLOW_MS,
  startVelocity,
  tickPowerups,
  type PowerupClock,
} from "./rules";

test("three lives, and losing one never goes below zero", () => {
  expect(MAX_LIVES).toBe(3);
  expect(loseLife(3)).toBe(2);
  expect(loseLife(1)).toBe(0);
  expect(loseLife(0)).toBe(0);
});

test("level 1 starts at 75% and speed 200", () => {
  expect(levelSettings(1)).toEqual({ enemySpeed: 200, targetCoverage: 75 });
  expect(levelSettings(0)).toEqual(levelSettings(1));
});

test("each level is faster and needs more coverage, up to the caps", () => {
  expect(levelSettings(2)).toEqual({ enemySpeed: 220, targetCoverage: 77 });
  expect(levelSettings(5)).toEqual({ enemySpeed: 280, targetCoverage: 83 });
  expect(levelSettings(11).enemySpeed).toBe(400);
  expect(levelSettings(50)).toEqual({ enemySpeed: 400, targetCoverage: 95 });
});

test("coverage and level completion", () => {
  expect(coveragePct(25, 100)).toBe(25);
  expect(coveragePct(5, 0)).toBe(0);
  expect(isLevelComplete(74.9, 75)).toBe(false);
  expect(isLevelComplete(75, 75)).toBe(true);
});

test("the fireball starts on a diagonal at the level's speed", () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 20; i++) {
    const { vx, vy } = startVelocity(220, rng);
    expect(Math.abs(vx)).toBe(220);
    expect(Math.abs(vy)).toBe(220);
  }
  expect(startVelocity(100, () => 0.1)).toEqual({ vx: -100, vy: -100 });
  expect(startVelocity(100, () => 0.9)).toEqual({ vx: 100, vy: 100 });
});

test("pickup delays stay in range", () => {
  const rng = mulberry32(1);
  for (let i = 0; i < 100; i++) {
    const d = nextPickupDelay(rng);
    expect(d).toBeGreaterThanOrEqual(PICKUP_DELAY_MIN_MS);
    expect(d).toBeLessThan(PICKUP_DELAY_MAX_MS);
  }
});

test("a pickup appears once the delay runs out, then times out", () => {
  const rng = mulberry32(3);
  let clock: PowerupClock = { spawnInMs: 1000, pickupLeftMs: 0, slowLeftMs: 0 };

  let t = tickPowerups(clock, 600, rng);
  expect(t.spawn).toBe(false);
  expect(t.clock.spawnInMs).toBe(400);

  t = tickPowerups(t.clock, 400, rng);
  expect(t.spawn).toBe(true);
  expect(t.clock.pickupLeftMs).toBe(PICKUP_LIFETIME_MS);
  clock = t.clock;

  // While a pickup is on the board, no new one spawns.
  t = tickPowerups(clock, PICKUP_LIFETIME_MS - 1, rng);
  expect(t.spawn).toBe(false);
  expect(t.expired).toBe(false);
  expect(t.clock.pickupLeftMs).toBe(1);

  t = tickPowerups(t.clock, 1, rng);
  expect(t.expired).toBe(true);
  expect(t.clock.pickupLeftMs).toBe(0);
  expect(t.clock.spawnInMs).toBeGreaterThanOrEqual(PICKUP_DELAY_MIN_MS);
});

test("collecting slows the fireball for exactly 5 s", () => {
  const rng = mulberry32(5);
  let clock = collectPickup(rng);
  expect(clock.slowLeftMs).toBe(SLOW_MS);
  expect(clock.pickupLeftMs).toBe(0);
  expect(enemySpeedFactor(clock)).toBe(SLOW_FACTOR);

  let t = tickPowerups(clock, 4999, rng);
  expect(t.slowEnded).toBe(false);
  expect(enemySpeedFactor(t.clock)).toBe(SLOW_FACTOR);

  t = tickPowerups(t.clock, 1, rng);
  expect(t.slowEnded).toBe(true);
  expect(enemySpeedFactor(t.clock)).toBe(1);

  // It only reports the end once.
  clock = t.clock;
  expect(tickPowerups(clock, 16, rng).slowEnded).toBe(false);
});

test("a negative delta changes nothing", () => {
  const rng = mulberry32(9);
  const clock = newPowerupClock(rng);
  const t = tickPowerups(clock, -50, rng);
  expect(t.clock).toEqual(clock);
  expect(clock.slowLeftMs).toBe(0);
  expect(enemySpeedFactor(clock)).toBe(1);
});

test("skipping a pickup reschedules it and keeps any slow-down", () => {
  const rng = mulberry32(11);
  const clock = skipPickup(
    { spawnInMs: 0, pickupLeftMs: PICKUP_LIFETIME_MS, slowLeftMs: 1200 },
    rng,
  );
  expect(clock.pickupLeftMs).toBe(0);
  expect(clock.slowLeftMs).toBe(1200);
  expect(clock.spawnInMs).toBeGreaterThanOrEqual(PICKUP_DELAY_MIN_MS);
});

const grid: Grid = { originX: 0, originY: 0, cols: 20, rows: 20, cellSize: 3 };

test("pickups land on open cells away from the edge", () => {
  const filled = new Uint8Array(grid.cols * grid.rows);
  for (let c = 0; c < 20; c++) for (let r = 0; r < 10; r++) filled[idx(grid, c, r)] = 1;
  const rng = mulberry32(21);
  for (let i = 0; i < 50; i++) {
    const cell = pickPickupCell(grid, filled, rng, 3);
    expect(cell).not.toBeNull();
    if (!cell) continue;
    expect(filled[idx(grid, cell.c, cell.r)]).toBe(0);
    expect(cell.c).toBeGreaterThanOrEqual(3);
    expect(cell.c).toBeLessThan(17);
    expect(cell.r).toBeLessThan(17);
  }
});

test("no pickup cell when the board is full or too small", () => {
  const full = new Uint8Array(grid.cols * grid.rows).fill(1);
  expect(pickPickupCell(grid, full, mulberry32(1))).toBeNull();
  const tiny: Grid = { ...grid, cols: 8, rows: 8 };
  expect(pickPickupCell(tiny, new Uint8Array(64), mulberry32(1), 4)).toBeNull();
});
