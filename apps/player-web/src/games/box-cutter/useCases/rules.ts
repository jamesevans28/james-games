/** Box Cutter rules: lives, levels and the slow-down power-up. Pure, no Phaser. */
import { DEFAULT_CONFIG, type GameConfig } from "../entities/GameState";
import { idx, type Cell, type Grid } from "./grid";

// --- Lives -----------------------------------------------------------------

export const MAX_LIVES = 3;

export function loseLife(lives: number): number {
  return Math.max(0, lives - 1);
}

// --- Levels ----------------------------------------------------------------

export type LevelSettings = {
  /** Enemy per-axis speed, px/s. */
  enemySpeed: number;
  /** Coverage (%) that clears the level. */
  targetCoverage: number;
};

/** Each level the fireball gets faster and a little more of the board must be boxed off. */
export function levelSettings(level: number, config: GameConfig = DEFAULT_CONFIG): LevelSettings {
  const n = Math.max(1, Math.floor(level)) - 1;
  return {
    enemySpeed: Math.min(
      config.maxBallSpeed,
      config.initialBallSpeed + n * config.ballSpeedIncrement,
    ),
    targetCoverage: Math.min(
      config.maxTargetCoverage,
      config.initialTargetCoverage + n * config.targetCoverageIncrement,
    ),
  };
}

export function coveragePct(filledCount: number, totalCells: number): number {
  return totalCells <= 0 ? 0 : (filledCount / totalCells) * 100;
}

export function isLevelComplete(coverage: number, target: number): boolean {
  return coverage >= target;
}

/** The fireball starts each level heading along a random diagonal. */
export function startVelocity(speed: number, rng: () => number): { vx: number; vy: number } {
  return {
    vx: rng() < 0.5 ? -speed : speed,
    vy: rng() < 0.5 ? -speed : speed,
  };
}

// --- Slow-down power-up ----------------------------------------------------

/** How long a pickup slows the fireball. */
export const SLOW_MS = 5000;
/** The fireball's speed while slowed. */
export const SLOW_FACTOR = 0.5;
/** A pickup disappears if nobody grabs it in time. */
export const PICKUP_LIFETIME_MS = 8000;
export const PICKUP_DELAY_MIN_MS = 6000;
export const PICKUP_DELAY_MAX_MS = 12000;

export type PowerupClock = {
  /** Time until the next pickup appears; only counts down while none is on the board. */
  spawnInMs: number;
  /** Time the pickup on the board has left; 0 means there is none. */
  pickupLeftMs: number;
  /** Slow-motion time left; 0 means the fireball is at full speed. */
  slowLeftMs: number;
};

export function nextPickupDelay(rng: () => number): number {
  return PICKUP_DELAY_MIN_MS + Math.floor(rng() * (PICKUP_DELAY_MAX_MS - PICKUP_DELAY_MIN_MS));
}

export function newPowerupClock(rng: () => number): PowerupClock {
  return { spawnInMs: nextPickupDelay(rng), pickupLeftMs: 0, slowLeftMs: 0 };
}

export type PowerupTick = {
  clock: PowerupClock;
  /** A pickup should appear now. */
  spawn: boolean;
  /** The pickup on the board timed out. */
  expired: boolean;
  /** The slow-down just wore off. */
  slowEnded: boolean;
};

/** Advance the power-up clock by `deltaMs` of play time (the scene only ticks while playing). */
export function tickPowerups(clock: PowerupClock, deltaMs: number, rng: () => number): PowerupTick {
  const dt = Math.max(0, deltaMs);
  const slowLeftMs = Math.max(0, clock.slowLeftMs - dt);
  const slowEnded = clock.slowLeftMs > 0 && slowLeftMs === 0;

  if (clock.pickupLeftMs > 0) {
    const left = clock.pickupLeftMs - dt;
    if (left <= 0) {
      return {
        clock: { spawnInMs: nextPickupDelay(rng), pickupLeftMs: 0, slowLeftMs },
        spawn: false,
        expired: true,
        slowEnded,
      };
    }
    return {
      clock: { ...clock, pickupLeftMs: left, slowLeftMs },
      spawn: false,
      expired: false,
      slowEnded,
    };
  }

  const spawnInMs = clock.spawnInMs - dt;
  if (spawnInMs <= 0) {
    return {
      clock: { spawnInMs: 0, pickupLeftMs: PICKUP_LIFETIME_MS, slowLeftMs },
      spawn: true,
      expired: false,
      slowEnded,
    };
  }
  return { clock: { ...clock, spawnInMs, slowLeftMs }, spawn: false, expired: false, slowEnded };
}

/** The player grabbed the pickup: slow the fireball and schedule the next one. */
export function collectPickup(rng: () => number): PowerupClock {
  return { spawnInMs: nextPickupDelay(rng), pickupLeftMs: 0, slowLeftMs: SLOW_MS };
}

/** There was nowhere to put the pickup: try again later. */
export function skipPickup(clock: PowerupClock, rng: () => number): PowerupClock {
  return { ...clock, spawnInMs: nextPickupDelay(rng), pickupLeftMs: 0 };
}

export function enemySpeedFactor(clock: PowerupClock): number {
  return clock.slowLeftMs > 0 ? SLOW_FACTOR : 1;
}

/**
 * A random open cell for a pickup, at least `margin` cells from the edge of the
 * board so it never sits on the outer border. Null if no open cell turned up.
 */
export function pickPickupCell(
  grid: Grid,
  filled: Uint8Array,
  rng: () => number,
  margin = 6,
  tries = 40,
): Cell | null {
  const spanC = grid.cols - margin * 2;
  const spanR = grid.rows - margin * 2;
  if (spanC <= 0 || spanR <= 0) return null;
  for (let i = 0; i < tries; i++) {
    const c = margin + Math.min(spanC - 1, Math.floor(rng() * spanC));
    const r = margin + Math.min(spanR - 1, Math.floor(rng() * spanR));
    if (filled[idx(grid, c, r)] !== 1) return { c, r };
  }
  return null;
}
