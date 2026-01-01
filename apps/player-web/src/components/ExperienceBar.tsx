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
  label,
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
      {/* <div className="flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
        <span>{label ?? `Level ${level}`}</span>
        <span>
          {Math.round(progress)}/{safeRequired} XP
        </span>
      </div> */}
      <div className="relative h-4 rounded-full bg-flingo-100 overflow-hidden border border-flingo-200/50">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${fillPercent}%`,
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 8px, transparent 8px, transparent 16px)",
            background: "linear-gradient(90deg, #c8ff32 0%, #32d4ff 50%, #ff3eb5 100%)",
            boxShadow: celebrate
              ? "0 0 18px rgba(200, 255, 50, 0.6)"
              : "0 0 12px rgba(200, 255, 50, 0.3)",
          }}
        />
        <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-white via-transparent to-white pointer-events-none" />
      </div>
      <div className="flex items-center justify-between text-xs text-flingo-800 font-medium">
        <span>Level {level}</span>
        {pendingText && (
          <span className="text-neon-lime font-bold animate-bounce">{pendingText}</span>
        )}
      </div>
    </div>
  );
}
