/** Cosmic Clash rules: pure functions, no Phaser. Distances are design px, times ms. */

export type PowerUpType = "doubleBullet" | "rapidFire" | "shield";

export type Wave = {
  rows: number;
  cols: number;
  /** The top `strongRows` rows are tougher aliens. */
  strongRows: number;
  /** Hits a strong alien takes; normal aliens always take one. */
  strongHealth: number;
  /** Sideways formation speed in px/s. */
  speed: number;
  /** Time between alien shots, or null when the aliens don't shoot yet. */
  fireDelayMs: number | null;
};

/** Points for each alien destroyed. */
export const POINTS_PER_ALIEN = 10;
/** How far the formation drops each time it reaches a side. */
export const FORMATION_DROP = 18;
export const FORMATION_SPACING = 60;

/**
 * The formation for a wave (1-based). Wave 1 is calm: no shooting, no strong
 * aliens. From wave 3 the top row is strong, from wave 4 the top two, and from
 * wave 6 they take three hits. Speed grows for six waves and then holds.
 */
export function waveFor(level: number): Wave {
  const n = Math.max(1, Math.floor(level));
  const strongRows = n >= 4 ? 2 : n === 3 ? 1 : 0;
  const speed = 15.6 + Math.min(n - 1, 6) * 3.12;
  return {
    rows: 4,
    cols: 8,
    strongRows,
    strongHealth: n >= 6 ? 3 : 2,
    speed,
    fireDelayMs: alienFireDelay(n),
  };
}

function alienFireDelay(level: number): number | null {
  if (level < 2) return null;
  if (level === 2) return 8000;
  if (level === 3) return 6000;
  if (level === 4) return 4000;
  return 3000;
}

export type AlienSlot = { x: number; y: number; row: number; strong: boolean; health: number };

/** Where each alien of a wave starts: a grid centred across `width`, top row at `top`. */
export function formation(wave: Wave, width: number, top: number): AlienSlot[] {
  const startX = (width - (wave.cols - 1) * FORMATION_SPACING) / 2;
  const slots: AlienSlot[] = [];
  for (let row = 0; row < wave.rows; row++) {
    const strong = row < wave.strongRows;
    for (let col = 0; col < wave.cols; col++) {
      slots.push({
        x: startX + col * FORMATION_SPACING,
        y: top + row * FORMATION_SPACING,
        row,
        strong,
        health: strong ? wave.strongHealth : 1,
      });
    }
  }
  return slots;
}

/** True when moving the formation by `dx` would push any alien past a side. */
export function hitsSide(xs: readonly number[], dx: number, minX: number, maxX: number): boolean {
  return xs.some((x) => x + dx <= minX || x + dx >= maxX);
}

/** One bullet lands on an alien. */
export function hitAlien(health: number): { health: number; destroyed: boolean; points: number } {
  const left = Math.max(0, health - 1);
  const destroyed = left === 0;
  return { health: left, destroyed, points: destroyed ? POINTS_PER_ALIEN : 0 };
}

/** Power-ups in the order they unlock: double shot at wave 2, rapid fire at 3, shield at 4. */
export function powerupUnlocks(level: number): PowerUpType[] {
  const types: PowerUpType[] = [];
  if (level >= 2) types.push("doubleBullet");
  if (level >= 3) types.push("rapidFire");
  if (level >= 4) types.push("shield");
  return types;
}

export const POWERUP_DURATION_MS: Record<PowerUpType, number> = {
  doubleBullet: 8000,
  rapidFire: 8000,
  shield: 7000,
};
export const POWERUP_COOLDOWN_MS = 9000;
export const POWERUP_CHANCE = 0.35;

/**
 * Maybe drop a power-up where an alien died: only once one is unlocked, at most
 * once per cooldown, and then with a 35% chance. `rng` is only used when a drop
 * is possible, so the sequence stays repeatable.
 */
export function rollPowerup(
  level: number,
  sinceLastDropMs: number,
  rng: () => number,
): PowerUpType | null {
  const available = powerupUnlocks(level);
  if (available.length === 0) return null;
  if (sinceLastDropMs < POWERUP_COOLDOWN_MS) return null;
  if (rng() >= POWERUP_CHANCE) return null;
  return available[Math.min(available.length - 1, Math.floor(rng() * available.length))] ?? null;
}

export const BASE_FIRE_MS = 550;

/** Auto-fire interval: rapid fire halves it. */
export const fireIntervalMs = (rapid: boolean): number => (rapid ? BASE_FIRE_MS / 2 : BASE_FIRE_MS);

/** Horizontal offsets of the bullets in one volley. */
export const shotOffsets = (double: boolean): number[] => (double ? [-15, 15] : [0]);

/** A random index in [0, length), or -1 for an empty list. */
export function pickIndex(length: number, rng: () => number): number {
  if (length <= 0) return -1;
  return Math.min(length - 1, Math.floor(rng() * length));
}
