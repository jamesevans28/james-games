import { test, expect } from "vitest";
import {
  BALL_BASE_SPEED,
  BALL_MAX_SPEED,
  BALL_MIN_SPEED,
  ballSpeed,
  cooledDown,
  discsToSpawn,
  discValue,
  fireballIntervalFor,
  MAX_BALLS,
  MAX_DISCS,
  paddleBounce,
  randInt,
  reflect,
  rollPowerUp,
  speedFor,
  splitBalls,
  type BallMotion,
} from "./rules";
import { mulberry32 } from "../../../platform/rng";

const deg = (d: number) => (d * Math.PI) / 180;
const speedOf = (b: { vx: number; vy: number }) => Math.hypot(b.vx, b.vy);

test("ball speed ramps every 8 s of play, to a cap", () => {
  expect(speedFor(0)).toBe(BALL_BASE_SPEED);
  expect(speedFor(7_999)).toBe(BALL_BASE_SPEED);
  expect(speedFor(8_000)).toBe(BALL_BASE_SPEED + 20);
  expect(speedFor(80_000)).toBe(BALL_BASE_SPEED + 200);
  expect(speedFor(60 * 60_000)).toBe(BALL_MAX_SPEED);
  expect(speedFor(-500)).toBe(BALL_BASE_SPEED);
  let prev = speedFor(0);
  for (let t = 0; t <= 300_000; t += 1_000) {
    expect(speedFor(t)).toBeGreaterThanOrEqual(prev);
    prev = speedFor(t);
  }
});

test("slow power-up takes a quarter off, within the limits", () => {
  expect(ballSpeed(0, false)).toBe(BALL_BASE_SPEED);
  expect(ballSpeed(0, true)).toBe(BALL_BASE_SPEED * 0.75);
  expect(ballSpeed(60 * 60_000, true)).toBe(BALL_MAX_SPEED * 0.75);
  expect(ballSpeed(0, true)).toBeGreaterThanOrEqual(BALL_MIN_SPEED);
});

test("fireballs come more often over time, never more than one per 2 s", () => {
  expect(fireballIntervalFor(0)).toBe(4_000);
  expect(fireballIntervalFor(9_999)).toBe(4_000);
  expect(fireballIntervalFor(10_000)).toBe(3_800);
  expect(fireballIntervalFor(50_000)).toBe(3_000);
  expect(fireballIntervalFor(100_000)).toBe(2_000);
  expect(fireballIntervalFor(10 * 60_000)).toBe(2_000);
});

test("paddle bounce always goes up at the requested speed", () => {
  for (const offset of [-3, -1, -0.5, 0, 0.3, 1, 3]) {
    const v = paddleBounce(offset, 500);
    expect(v.vy).toBeLessThan(0);
    expect(Math.abs(v.vx)).toBeLessThanOrEqual(500 * 0.85 + 1e-9);
    expect(Math.abs(v.vy)).toBeGreaterThanOrEqual(500 * 0.45);
  }
  expect(paddleBounce(0, 500)).toEqual({ vx: 0, vy: -500 });
  expect(paddleBounce(1, 500).vx).toBeCloseTo(425);
  expect(paddleBounce(-1, 500).vx).toBeCloseTo(-425);
  expect(speedOf(paddleBounce(0.5, 500))).toBeCloseTo(500);
});

test("reflect mirrors about the normal", () => {
  const r = reflect(0, 1, 0, -1); // straight down onto a surface facing up
  expect(r.x).toBeCloseTo(0);
  expect(r.y).toBeCloseTo(-1);
  const s = Math.SQRT1_2;
  const d = reflect(s, s, 0, -1); // 45° down-right bounces up-right
  expect(d.x).toBeCloseTo(s);
  expect(d.y).toBeCloseTo(-s);
  expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
});

test("multiball splits the first ball into three, fanned 25° apart", () => {
  const ball: BallMotion = { x: 200, y: 400, vx: 0, vy: -300 };
  const other: BallMotion = { x: 50, y: 60, vx: 10, vy: 20 };
  const out = splitBalls([ball, other], 500, 0);
  expect(out).toHaveLength(4);
  expect(out[1]).toEqual(other);
  const [a, , b, c] = out;
  for (const n of [a, b, c]) expect(speedOf(n!)).toBeCloseTo(500);
  expect(Math.atan2(a!.vy, a!.vx)).toBeCloseTo(deg(-90));
  expect(Math.atan2(b!.vy, b!.vx)).toBeCloseTo(deg(-65));
  expect(Math.atan2(c!.vy, c!.vx)).toBeCloseTo(deg(-115));
  expect([a!.x, b!.x, c!.x]).toEqual([200, 210, 190]);
  // the input is untouched
  expect(ball).toEqual({ x: 200, y: 400, vx: 0, vy: -300 });
});

test("multiball uses the fallback angle for a resting ball, and respects the cap", () => {
  expect(splitBalls([], 500, 0)).toEqual([]);
  const resting = splitBalls([{ x: 0, y: 0, vx: 0, vy: 0 }], 400, deg(-90));
  expect(resting[0]!.vy).toBeCloseTo(-400);
  expect(resting).toHaveLength(3);

  const ball = (i: number): BallMotion => ({ x: i, y: i, vx: 0, vy: -300 });
  const almost = Array.from({ length: MAX_BALLS - 1 }, (_, i) => ball(i));
  expect(splitBalls(almost, 500, 0)).toHaveLength(MAX_BALLS);
  const full = Array.from({ length: MAX_BALLS }, (_, i) => ball(i));
  expect(splitBalls(full, 500, 0)).toEqual(full);
});

test("cooldowns stop one contact scoring twice", () => {
  expect(cooledDown(undefined, 0, 400)).toBe(true);
  expect(cooledDown(1_000, 1_100, 400)).toBe(false);
  expect(cooledDown(1_000, 1_400, 400)).toBe(true);
});

test("disc values are 1 to 10, repeatable by seed", () => {
  expect(discValue(() => 0)).toBe(1);
  expect(discValue(() => 0.999999)).toBe(10);
  const rng = mulberry32(4);
  const seen = new Set(Array.from({ length: 500 }, () => discValue(rng)));
  expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(randInt(() => 0.5, 60, 60)).toBe(60);
  const a = mulberry32(11);
  const b = mulberry32(11);
  expect([discValue(a), discValue(a), discValue(a)]).toEqual([
    discValue(b),
    discValue(b),
    discValue(b),
  ]);
});

test("discs spawn one or two at a time, up to three on screen", () => {
  expect(discsToSpawn(() => 0.1, 0)).toBe(2);
  expect(discsToSpawn(() => 0.9, 0)).toBe(1);
  expect(discsToSpawn(() => 0.1, MAX_DISCS - 1)).toBe(1);
  expect(discsToSpawn(() => 0.1, MAX_DISCS)).toBe(0);
});

test("power-ups are rare and evenly split", () => {
  expect(rollPowerUp(() => 0.5)).toBeNull();
  const seq = (values: number[]) => {
    let i = 0;
    return () => values[i++] ?? 0;
  };
  expect(rollPowerUp(seq([0.1, 0.2]))).toBe("slow");
  expect(rollPowerUp(seq([0.1, 0.7]))).toBe("big");
  const rng = mulberry32(2);
  const rolls = Array.from({ length: 2_000 }, () => rollPowerUp(rng));
  const hits = rolls.filter((r) => r !== null).length / rolls.length;
  expect(hits).toBeGreaterThan(0.3);
  expect(hits).toBeLessThan(0.4);
});
