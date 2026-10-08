import type { ExperienceSummary } from "../../../lib/api";

/** One stretch of the XP bar animation, at one level. Percentages are 0-100. */
export type XpSegment = { level: number; fromPct: number; toPct: number };

type Xp = Pick<ExperienceSummary, "level" | "progress" | "required">;

function pct(xp: Xp): number {
  const p = (xp.progress / Math.max(1, xp.required || 1)) * 100;
  return Math.max(0, Math.min(100, Number.isFinite(p) ? p : 0));
}

/**
 * How the bar moves from the XP before a run to the XP after it. A level up
 * fills the old level to the end, then fills the new level from empty.
 */
export function xpSegments(from: Xp | null, to: Xp | null): XpSegment[] {
  if (!from && !to) return [];
  if (!to) return [{ level: from!.level, fromPct: pct(from!), toPct: pct(from!) }];
  if (!from) return [{ level: to.level, fromPct: pct(to), toPct: pct(to) }];
  if (to.level > from.level) {
    return [
      { level: from.level, fromPct: pct(from), toPct: 100 },
      { level: to.level, fromPct: 0, toPct: pct(to) },
    ];
  }
  return [{ level: to.level, fromPct: Math.min(pct(from), pct(to)), toPct: pct(to) }];
}
