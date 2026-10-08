/** Pure gesture maths for the input kit (no Phaser, unit-tested). */
export type Direction4 = "up" | "down" | "left" | "right";

export type SwipeOptions = {
  /** Minimum travel in design pixels. */
  threshold?: number;
  /** Longer than this is a drag, not a swipe. */
  maxMs?: number;
};

/** A swipe's direction, or null for a tap, a slow drag or too short a move. */
export function classifySwipe(
  dx: number,
  dy: number,
  durationMs: number,
  { threshold = 30, maxMs = 600 }: SwipeOptions = {},
): Direction4 | null {
  if (durationMs > maxMs) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < threshold) return null;
  if (ax > ay) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** Which of `count` equal vertical strips `x` falls in (0 = leftmost). */
export function zoneIndex(x: number, width: number, count: number): number {
  if (count <= 1 || width <= 0) return 0;
  const i = Math.floor((x / width) * count);
  return Math.min(count - 1, Math.max(0, i));
}

/** Left half → -1, right half → 1. */
export function sideOf(x: number, width: number): -1 | 1 {
  return zoneIndex(x, width, 2) === 0 ? -1 : 1;
}

/** A release this soon after the press counts as a tap. */
export function isTap(pressedMs: number, tapMs = 180): boolean {
  return pressedMs <= tapMs;
}

export const OPPOSITE: Record<Direction4, Direction4> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
