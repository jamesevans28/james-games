export type ExperienceBarProps = {
  level: number;
  progress: number;
  required: number;
  label?: string;
  incomingXp?: number;
};

/** A static level bar (profile). The game-over dialog animates its own (pages/games/gameover/XpBar). */
export function ExperienceBar({
  level,
  progress,
  required,
  label,
  incomingXp,
}: ExperienceBarProps) {
  const percent = Math.max(0, Math.min(100, (progress / Math.max(1, required || 1)) * 100));
  const pendingText = incomingXp && incomingXp > 0 ? `+${incomingXp} XP` : null;

  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-label={label ?? `Level ${level} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className="relative h-4 overflow-hidden rounded-full border border-line bg-paper-2"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{
            width: `${percent}%`,
            background:
              "linear-gradient(90deg, var(--color-sun) 0%, var(--color-tomato) 50%, var(--color-grape) 100%)",
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs font-medium text-ink">
        <span>{label ?? `Level ${level}`}</span>
        {pendingText && <span className="font-bold text-brand">{pendingText}</span>}
      </div>
    </div>
  );
}
