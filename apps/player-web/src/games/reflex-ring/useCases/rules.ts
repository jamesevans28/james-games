/** Reflex Ring rules: pure functions, no Phaser. Angles are radians. */

const TAU = Math.PI * 2;

/** a − b wrapped to (−π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % TAU;
  if (d <= -Math.PI) d += TAU;
  if (d > Math.PI) d -= TAU;
  return d;
}

/** The hit zone is a little wider than the drawn wedge, to forgive young fingers. */
export const HIT_FORGIVENESS = 1.2;
/** The centre fifth of the wedge counts as perfect. */
export const PERFECT_RATIO = 0.2;

export function segmentHit(
  angle: number,
  center: number,
  width: number,
  forgiveness = HIT_FORGIVENESS,
): boolean {
  return Math.abs(angleDiff(angle, center)) <= (width * forgiveness) / 2;
}

export function isPerfect(angle: number, center: number, width: number): boolean {
  return Math.abs(angleDiff(angle, center)) <= (width * PERFECT_RATIO) / 2;
}

export const pointsFor = (perfect: boolean): number => (perfect ? 2 : 1);

/** After each hit the arrow speeds up 3% (to a cap) and reverses direction. */
export function nextVelocity(velocity: number, maxSpeed: number): number {
  const speed = Math.min(Math.abs(velocity) * 1.03, maxSpeed);
  return -Math.sign(velocity || 1) * speed;
}

/**
 * A new target at least `minSep` and at most `maxSep` away from the old one, so
 * it never appears under the arrow and never needs a near-full lap.
 */
export function pickTarget(
  rng: () => number,
  avoid: number,
  minSep = (40 * Math.PI) / 180,
  maxSep = Math.PI,
): number {
  const span = maxSep - minSep;
  const offset = minSep + rng() * span;
  const side = rng() < 0.5 ? -1 : 1;
  const t = (avoid + side * offset) % TAU;
  return t < 0 ? t + TAU : t;
}

export const POWERUPS = ["slow-time", "wide-wedge", "perfect-touch", "auto-hit"] as const;
export type Powerup = (typeof POWERUPS)[number];

export function powerupRoll(rng: () => number): Powerup {
  return (
    POWERUPS[Math.min(POWERUPS.length - 1, Math.floor(rng() * POWERUPS.length))] ?? "slow-time"
  );
}
