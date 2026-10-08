/** A block's horizontal extent on the tower: left edge and width, in design pixels. */
export type Span = { x: number; w: number };

/** The part of `moving` that sits on top of `below`, or null if they don't touch. */
export function overlap(moving: Span, below: Span): Span | null {
  const left = Math.max(moving.x, below.x);
  const right = Math.min(moving.x + moving.w, below.x + below.w);
  const w = right - left;
  return w > 0 ? { x: left, w } : null;
}

export type DropResult = {
  /** What stays on the tower (the next block's width), or null when the run is over. */
  kept: Span | null;
  /** The overhang that gets chopped off and falls, if any. */
  cut: Span | null;
  /** True when the drop was within `snap` pixels and kept the full width. */
  perfect: boolean;
};

/**
 * Drops `moving` onto `below`. The overhang is cut off; a drop within `snap`
 * pixels of `below` counts as perfect and keeps the whole block (kinder for kids).
 */
export function dropBlock(moving: Span, below: Span, snap = 0): DropResult {
  if (Math.abs(moving.x - below.x) <= snap && moving.w <= below.w) {
    return { kept: { x: below.x, w: moving.w }, cut: null, perfect: true };
  }
  const kept = overlap(moving, below);
  if (!kept) return { kept: null, cut: moving, perfect: false };
  const cutW = moving.w - kept.w;
  if (cutW <= 0) return { kept, cut: null, perfect: false };
  const cutX = moving.x < kept.x ? moving.x : kept.x + kept.w;
  return { kept, cut: { x: cutX, w: cutW }, perfect: false };
}

/**
 * Moves the sliding block by `step` pixels, bouncing between `min` and `max`
 * (its left edge). Returns the new position and direction.
 */
export function bounce(
  x: number,
  dir: 1 | -1,
  step: number,
  min: number,
  max: number,
): { x: number; dir: 1 | -1 } {
  const next = x + dir * step;
  if (next > max) return { x: Math.max(min, 2 * max - next), dir: -1 };
  if (next < min) return { x: Math.min(max, 2 * min - next), dir: 1 };
  return { x: next, dir };
}

/** Slide speed in pixels per second: a little faster with every block, capped. */
export function speedFor(placed: number): number {
  return Math.min(220 + placed * 12, 520);
}
