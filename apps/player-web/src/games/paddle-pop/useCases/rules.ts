/** Paddle Pop rules: pure functions, no Phaser. Speeds are px/s, times are ms of play. */

export const BALL_BASE_SPEED = 420;
export const BALL_MAX_SPEED = 850;
/** The ball never goes slower than this, even slowed. */
export const BALL_MIN_SPEED = BALL_BASE_SPEED * 0.5;
const SPEED_STEP_MS = 8_000;
const SPEED_STEP = 20;
/** The slow power-up takes a quarter off the ball speed. */
export const SLOW_FACTOR = 0.75;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Nominal ball speed after `elapsedMs` of play: +20 px/s every 8 s, up to the cap. */
export function speedFor(elapsedMs: number): number {
  const steps = Math.floor(Math.max(0, elapsedMs) / SPEED_STEP_MS);
  return Math.min(BALL_MAX_SPEED, BALL_BASE_SPEED + steps * SPEED_STEP);
}

/** The speed every ball actually travels at, with the slow power-up applied. */
export function ballSpeed(elapsedMs: number, slowed: boolean): number {
  return clamp(speedFor(elapsedMs) * (slowed ? SLOW_FACTOR : 1), BALL_MIN_SPEED, BALL_MAX_SPEED);
}

/** Gap between fireballs: 4 s at the start, 200 ms shorter every 10 s, never under 2 s. */
export function fireballIntervalFor(elapsedMs: number): number {
  const steps = Math.floor(Math.max(0, elapsedMs) / 10_000);
  return Math.max(2_000, 4_000 - steps * 200);
}

export type Velocity = { vx: number; vy: number };

/**
 * Bounce off the paddle. `offset` is where the ball hit it, from −1 (left end)
 * to 1 (right end): the further out, the steeper the sideways angle. The ball
 * always leaves upwards, and never too flat to come back.
 */
export function paddleBounce(offset: number, speed: number): Velocity {
  const maxVx = speed * 0.85;
  const vx = clamp(offset, -1, 1) * maxVx;
  const vy = -Math.max(speed * 0.45, Math.sqrt(Math.max(0, speed * speed - vx * vx)));
  return { vx, vy };
}

/** Mirror the unit direction (dx, dy) about the unit normal (nx, ny); returns a unit vector. */
export function reflect(dx: number, dy: number, nx: number, ny: number): { x: number; y: number } {
  const dot = dx * nx + dy * ny;
  const rx = dx - 2 * dot * nx;
  const ry = dy - 2 * dot * ny;
  const len = Math.max(1e-6, Math.hypot(rx, ry));
  return { x: rx / len, y: ry / len };
}

export type BallMotion = { x: number; y: number; vx: number; vy: number };

/** Multiball never puts more than this many balls in play. */
export const MAX_BALLS = 9;
const SPLIT_SPREAD = (25 * Math.PI) / 180;
const SPLIT_OFFSET_PX = 10;

/**
 * Multiball: the first ball splits into three, fanned 25° apart, all at `speed`.
 * The other balls carry on unchanged. New balls are appended, so index i of the
 * result is still ball i of the input. A ball that isn't moving uses
 * `fallbackAngle` (radians). Stops at `maxBalls`.
 */
export function splitBalls(
  balls: readonly BallMotion[],
  speed: number,
  fallbackAngle: number,
  maxBalls = MAX_BALLS,
): BallMotion[] {
  const [source, ...rest] = balls;
  if (!source) return [];
  const extra = Math.max(0, Math.min(2, maxBalls - balls.length));
  if (extra === 0) return balls.map((b) => ({ ...b }));
  const moving = Math.hypot(source.vx, source.vy) > 1;
  const base = moving ? Math.atan2(source.vy, source.vx) : fallbackAngle;
  const at = (angle: number, dx: number): BallMotion => ({
    x: source.x + dx,
    y: source.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  });
  const added = [
    at(base + SPLIT_SPREAD, SPLIT_OFFSET_PX),
    at(base - SPLIT_SPREAD, -SPLIT_OFFSET_PX),
  ];
  return [at(base, 0), ...rest.map((b) => ({ ...b })), ...added.slice(0, extra)];
}

/** Every 35 s one ball splits; the screen shakes for the 3 s before as a warning. */
export const SPLIT_INTERVAL_MS = 35_000;
export const SPLIT_WARNING_MS = 3_000;

// Scoring

/** One point each time a ball comes off the paddle. */
export const PADDLE_POINTS = 1;
/** A ball scores off the paddle at most once in this window. */
export const PADDLE_COOLDOWN_MS = 120;
/** A disc scores at most once in this window, so one contact can't score twice. */
export const DISC_COOLDOWN_MS = 400;

/** True when nothing has happened yet, or the last time was at least `cooldownMs` ago. */
export function cooledDown(lastMs: number | undefined, nowMs: number, cooldownMs: number): boolean {
  return lastMs === undefined || nowMs - lastMs >= cooldownMs;
}

/** An integer in [min, max]. */
export function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.min(max - min, Math.floor(rng() * (max - min + 1)));
}

/** Bonus discs are worth 1 to 10, shown on the disc. */
export const discValue = (rng: () => number): number => randInt(rng, 1, 10);

// Spawning

export const BONUS_INTERVAL_MS = 6_000;
export const BONUS_LIFETIME_MS = 5_000;
export const MAX_DISCS = 3;

/** Every bonus tick: one disc, sometimes (40%) two, never more than MAX_DISCS on screen. */
export function discsToSpawn(rng: () => number, onScreen: number): number {
  const wanted = rng() < 0.4 ? 2 : 1;
  return Math.max(0, Math.min(wanted, MAX_DISCS - onScreen));
}

export type PowerUp = "slow" | "big";
export const POWERUP_INTERVAL_MS = 5_000;
export const POWERUP_DURATION_MS = 10_000;
/** A power-up you don't collect disappears after this long. */
export const POWERUP_LIFETIME_MS = 3_500;

/** Every power-up tick: usually nothing, 35% of the time slow or big (half each). */
export function rollPowerUp(rng: () => number): PowerUp | null {
  if (rng() >= 0.35) return null;
  return rng() < 0.5 ? "slow" : "big";
}
