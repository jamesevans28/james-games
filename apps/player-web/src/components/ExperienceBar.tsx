import { useEffect, useMemo, useState } from "react";

export type ExperienceBarProps = {
  level: number;
  progress: number;
  required: number;
  label?: string;
  incomingXp?: number;
};

export function ExperienceBar({
  level,
  progress,
  required,
  incomingXp,
}: ExperienceBarProps) {
  const safeRequired = Math.max(1, required || 1);
  const [fillPercent, setFillPercent] = useState(() =>
    Math.min(100, (progress / safeRequired) * 100)
  );
  const [celebrate, setCelebrate] = useState(false);

  const clampedPercent = useMemo(
    () => Math.min(100, (progress / safeRequired) * 100),
    [progress, safeRequired]
  );

  useEffect(() => {
    setFillPercent(clampedPercent);
    setCelebrate(true);
    let timer: number | null = null;
    if (typeof window !== "undefined") {
      timer = window.setTimeout(() => setCelebrate(false), 900);
    }
    return () => {
      if (timer !== null && typeof window !== "undefined") {
        window.clearTimeout(timer);
      }
    };
  }, [clampedPercent]);

  const pendingText = incomingXp && incomingXp > 0 ? `+${incomingXp} XP` : null;

  return (
    <div className="space-y-2">
      {/* <div className="flex items-center justify-between text-xs uppercase tracking-wide text-ink-3">
        <span>{label ?? `Level ${level}`}</span>
        <span>
          {Math.round(progress)}/{safeRequired} XP
        </span>
      </div> */}
      <div className="relative h-4 rounded-full bg-paper-2 overflow-hidden border border-line">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${fillPercent}%`,
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 8px, transparent 8px, transparent 16px)",
            background: "linear-gradient(90deg, var(--color-sun) 0%, var(--color-tomato) 50%, var(--color-grape) 100%)",
            boxShadow: celebrate
              ? "0 2px 0 0 var(--color-edge)"
              : "none",
          }}
        />
        <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-white via-transparent to-white pointer-events-none" />
      </div>
      <div className="flex items-center justify-between text-xs text-ink font-medium">
        <span>Level {level}</span>
        {pendingText && (
          <span className="text-brand font-bold animate-bounce">{pendingText}</span>
        )}
      </div>
    </div>
  );
}
