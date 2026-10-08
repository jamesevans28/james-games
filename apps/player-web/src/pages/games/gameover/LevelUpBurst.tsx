import Confetti from "./Confetti";

/** Seconds to wait so the burst lands after the XP bar fills (see gameover.css). */
const AFTER_BAR_S = 2.2;

/** "Level up!" on the game-over dialog: a small inline moment, never a blocking modal. */
export default function LevelUpBurst({ level }: { level: number }) {
  return (
    <div
      role="status"
      className="relative mt-3 rounded-2xl border-2 border-edge bg-sun/30 px-4 py-2 text-center animate-bounce-in"
      style={{ animationDelay: `${AFTER_BAR_S}s`, animationFillMode: "both" }}
    >
      <Confetti count={12} delayS={AFTER_BAR_S} />
      <span className="font-display text-xl font-extrabold text-ink">Level up! </span>
      <span className="font-bold text-ink-2">You reached level {level}.</span>
    </div>
  );
}
