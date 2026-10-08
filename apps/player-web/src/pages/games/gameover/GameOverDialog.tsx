import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../../context/FirebaseAuthProvider";
import { cheerFor } from "../../../utils/cheer";
import StreakCelebration from "../../../components/StreakCelebration";
import Confetti from "./Confetti";
import LevelUpBurst from "./LevelUpBurst";
import XpBar from "./XpBar";
import { useRunSubmission } from "./useRunSubmission";
import { markSaveNudgeShown, readSaveNudgeShownAt, shouldShowSaveNudge } from "./saveNudge";

export type GameOverProps = {
  open: boolean;
  score: number | null;
  gameId?: string | null;
  /** The best score on this device before this run, for "New best!". */
  previousBest?: number;
  /** Duration of the run in milliseconds. */
  durationMs?: number;
  onClose: () => void;
  /** Restarts the game through the host. Called straight from the button: one tap. */
  onPlayAgain?: () => void;
  onViewLeaderboard?: () => void;
};

/**
 * The game-over dialog (T7.3). Every open is a new run: the panel mounts fresh,
 * so the score is posted once and all its state starts clean.
 */
export default function GameOverDialog({ open, ...props }: GameOverProps) {
  if (!open) return null;
  return <GameOverPanel {...props} />;
}

function GameOverPanel({
  score,
  gameId,
  previousBest = 0,
  durationMs,
  onClose,
  onPlayAgain,
  onViewLeaderboard,
}: Omit<GameOverProps, "open">) {
  const { user } = useAuth();
  // XP before this run, so the bar can fill from here once the server answers.
  const [startXp] = useState(() => user?.experience ?? null);
  const [showNudge] = useState(() =>
    shouldShowSaveNudge({
      isGuest: !user || user.isAnonymous,
      lastShownAt: readSaveNudgeShownAt(),
      now: Date.now(),
    }),
  );
  const { status, result, error } = useRunSubmission({ gameId, score, durationMs });
  const cheer = cheerFor(score, previousBest);

  useEffect(() => {
    if (showNudge) markSaveNudgeShown(Date.now());
  }, [showNudge]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const endXp = result?.summary ?? null;
  const showXp = Boolean(user) && Boolean(startXp ?? endXp) && status !== "skipped";

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center">
      <div
        aria-hidden
        className="absolute inset-0 bg-scrim/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-over-title"
        className="relative mx-3 mb-4 w-full max-w-md rounded-3xl border-2 border-edge bg-card shadow-sticker-lg sm:mb-0"
      >
        <div className="relative px-5 pb-4 pt-6 text-center">
          {cheer.isNewBest && <Confetti />}
          <h2
            id="game-over-title"
            className={
              cheer.isNewBest
                ? "inline-block rounded-full border-2 border-edge bg-sun px-4 py-1 font-display text-2xl font-extrabold text-on-accent shadow-sticker animate-bounce-in"
                : "font-display text-2xl font-extrabold text-brand"
            }
          >
            {cheer.headline}
          </h2>
          <p className="mt-3 font-display text-6xl font-extrabold leading-none text-ink">
            <span className="sr-only">Your score: </span>
            {score ?? 0}
          </p>
          {!cheer.isNewBest && previousBest > 0 && (
            <p className="mt-2 text-sm font-semibold text-ink-2">Your best: {previousBest}</p>
          )}
          {error && <p className="mt-2 text-sm text-ink-3">{error}</p>}
        </div>

        {(showXp || result?.newLevel || result?.stickerEarned) && (
          <div className="border-t-2 border-line px-5 py-4">
            {showXp && (
              <XpBar
                key={result ? "after" : "before"}
                from={startXp}
                to={endXp}
                xpAwarded={result?.awardedXp ?? 0}
              />
            )}
            {result?.newLevel !== undefined && <LevelUpBurst level={result.newLevel} />}
            {result?.stickerEarned && (
              <StreakCelebration
                stickerId={result.stickerEarned.id}
                delayS={result.newLevel !== undefined ? 2.8 : 1.2}
              />
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
          {onPlayAgain && (
            <button
              type="button"
              autoFocus
              className="btn btn-primary w-full py-4 text-xl"
              onClick={onPlayAgain}
            >
              Play again
            </button>
          )}
          <div className="flex gap-3">
            {onViewLeaderboard && (
              <button type="button" className="btn btn-outline flex-1" onClick={onViewLeaderboard}>
                Leaderboard
              </button>
            )}
            <button type="button" className="btn btn-outline flex-1" onClick={onClose}>
              Close
            </button>
          </div>
          {showNudge && (
            <Link
              to="/login"
              className="-mb-2 block py-3 text-center text-sm font-bold text-ink-2 underline underline-offset-4"
            >
              Save your progress
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
