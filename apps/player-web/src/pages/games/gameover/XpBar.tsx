import { useState, type CSSProperties } from "react";
import type { ExperienceSummary } from "../../../lib/api";
import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion";
import { xpSegments } from "./xpProgress";
import "./gameover.css";

type Props = {
  /** XP before this run (the profile when the dialog opened). */
  from: ExperienceSummary | null;
  /** XP after this run, from the POST /scores response; null while saving. */
  to: ExperienceSummary | null;
  xpAwarded: number;
};

/**
 * The level bar on the game-over dialog. It fills from the old XP to the new;
 * a level up fills the old level, then the new one. Reduced motion shows the end.
 * Give it a new `key` when `to` arrives so the animation starts from the top.
 */
export default function XpBar({ from, to, xpAwarded }: Props) {
  const segments = xpSegments(from, to);
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const index = reduced ? segments.length - 1 : Math.min(step, segments.length - 1);
  const seg = segments[index];
  if (!seg) return null;

  const fill = {
    width: `${seg.toPct}%`,
    "--xp-from": `${seg.fromPct}%`,
    background:
      "linear-gradient(90deg, var(--color-sun), var(--color-tomato) 60%, var(--color-grape))",
  } as CSSProperties;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm font-bold text-ink-2">
        <span>Level {seg.level}</span>
        {xpAwarded > 0 && <span className="font-extrabold text-brand">+{xpAwarded} XP</span>}
      </div>
      <div
        role="progressbar"
        aria-label={`Level ${seg.level} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(seg.toPct)}
        className="relative h-4 overflow-hidden rounded-full border-2 border-edge bg-paper-2"
      >
        <div
          key={index}
          className="g4j-xp-fill absolute inset-y-0 left-0 rounded-full"
          style={fill}
          onAnimationEnd={() => setStep(index + 1)}
        />
      </div>
    </div>
  );
}
