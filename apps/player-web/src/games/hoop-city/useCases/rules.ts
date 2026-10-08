/** Hoop City rules: pure functions, no Phaser. Distances are design px, times ms unless named. */

/**
 * How a pass through a ring went.
 * - `perfect`: through the middle without touching the rim
 * - `good`: through, off-centre, without touching the rim
 * - `rim`: through, but the ball hit the rim on the way
 * - `miss`: not through the opening at all
 */
export type PassQuality = "perfect" | "good" | "rim" | "miss";

/** Within this fraction of the opening width either side of centre is a perfect pass. */
export const PERFECT_FRACTION = 0.15;
/** The combo multiplier stops growing here, so a long run's score stays sensible. */
export const MAX_COMBO = 10;

/**
 * The rings lie flat, so the ball drops (or rises) through them and the offset that
 * matters is horizontal: the ball's `ballX` against the ring's centre `ringX`, where
 * `ringGap` is the width of the opening.
 */
export function passQuality(
  ballX: number,
  ringX: number,
  ringGap: number,
  touchedRim = false,
): PassQuality {
  const offset = Math.abs(ballX - ringX);
  if (!(ringGap > 0) || offset > ringGap / 2) return "miss";
  if (touchedRim) return "rim";
  return offset <= ringGap * PERFECT_FRACTION ? "perfect" : "good";
}

const clampCombo = (combo: number): number =>
  Math.min(MAX_COMBO, Math.max(1, Math.floor(combo) || 1));

/** Clean passes grow the combo (up to MAX_COMBO); touching the rim or missing resets it. */
export function comboNext(combo: number, quality: PassQuality): number {
  if (quality === "rim" || quality === "miss") return 1;
  return Math.min(MAX_COMBO, clampCombo(combo) + 1);
}

/** Points for a pass at the current combo: perfect doubles it, a rim touch scores 1. */
export function pointsFor(combo: number, quality: PassQuality): number {
  switch (quality) {
    case "miss":
      return 0;
    case "rim":
      return 1;
    case "good":
      return clampCombo(combo);
    case "perfect":
      return clampCombo(combo) * 2;
  }
}

export const GRAVITY_START = 680;
export const GRAVITY_PER_SECOND = 90;
export const GRAVITY_MAX = 1100;

/**
 * Gravity in px/s² after `elapsedMs` of play (counted from the first tap, pauses
 * excluded). It strengthens so the player has to keep tapping, and tops out after
 * about 4.7 s.
 */
export function gravityAt(elapsedMs: number): number {
  const seconds = Math.max(0, elapsedMs) / 1000;
  return Math.min(GRAVITY_MAX, GRAVITY_START + GRAVITY_PER_SECOND * seconds);
}

/** Hoops slide left at a steady speed (px/s). */
export const HOOP_SPEED = 140;
/** Ring centre heights stay clear of the HUD at the top and the bottom edge. */
export const HOOP_Y_MIN = 220;
export const HOOP_Y_MAX = 760;
/** Extra distance past the right edge where the next hoop appears. */
export const HOOP_GAP_MIN = 350;
export const HOOP_GAP_MAX = 550;

/** A whole number in [min, max] from a 0..1 random source. */
export function between(rng: () => number, min: number, max: number): number {
  const r = Math.min(Math.max(rng(), 0), 0.999999);
  return min + Math.floor(r * (max - min + 1));
}

/** Where the next hoop goes: how far past the right edge (`gap`) and at what height (`y`). */
export function nextHoop(rng: () => number): { gap: number; y: number } {
  const gap = between(rng, HOOP_GAP_MIN, HOOP_GAP_MAX);
  const y = between(rng, HOOP_Y_MIN, HOOP_Y_MAX);
  return { gap, y };
}

/**
 * Ease `current` toward `target`, frame-rate independently: `rate` is the fraction
 * of the distance closed per 60 fps frame.
 */
export function approach(current: number, target: number, rate: number, dtSeconds: number): number {
  const keep = Math.pow(1 - Math.min(Math.max(rate, 0), 1), Math.max(0, dtSeconds) * 60);
  return target + (current - target) * keep;
}
