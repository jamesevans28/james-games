import { useEffect, useRef } from "react";
import { postHighScore } from "../lib/api";
import { useAuth } from "../context/AuthProvider";

type Props = {
  open: boolean;
  score: number | null;
  gameId?: string | null; // gameId provided so dialog can post score
  onClose: () => void;
  onPlayAgain?: () => void;
  onViewLeaderboard?: () => void;
};

export default function ScoreDialog({
  open,
  score,
  gameId,
  onClose,
  onPlayAgain,
  onViewLeaderboard,
}: Props) {
  // track last posted signature so we post every distinct run's score
  // signature is `${gameId}:${score}`. This allows the dialog component to be
  // reused between games while still posting each new score once.
  const postedRef = useRef<string | null>(null);
  const { user } = useAuth?.() ?? ({ user: null } as any);
  useEffect(() => {
    if (!open) {
      console.log("ScoreDialog: not posting score because dialog is not open");
      return;
    }
    const s = Number(score || 0);
    const sig = `${gameId ?? ""}:${s}`;
    if (postedRef.current === sig) {
      console.log("ScoreDialog: score already posted for this run", { sig });
      return;
    }
    if (Number.isNaN(s) || s <= 0) {
      console.log("ScoreDialog: not posting score because score is zero/invalid", { score });
      return;
    }
    if (!gameId) {
      console.log("ScoreDialog: not posting score because gameId is missing", { gameId });
      return;
    }
    // Only authenticated users can post scores; skip if not logged in
    if (!user) {
      console.log("ScoreDialog: not posting score because user is not authenticated");
      return;
    }

    // mark intent to post for this signature immediately to avoid double-posts
    postedRef.current = sig;
    void postHighScore({ gameId, score: s })
      .then((res) => {
        console.log("ScoreDialog: posted score", { gameId, score: s });
        return res;
      })
      .catch((e) => {
        // on failure, clear the posted signature so retries are possible
        postedRef.current = null;
        console.warn("Failed to post high score", e);
      });
  }, [open, score, gameId, user]);
  if (!open) return null;
  const phrases = [
    "Great job!",
    "Awesome!",
    "Fantastic!",
    "Well done!",
    "Impressive!",
    "Outstanding!",
    "Superb!",
    "Excellent!",
    "Brilliant!",
    "Amazing!",
    "Incredible!",
    "Spectacular!",
    "Marvelous!",
    "Terrific!",
    "Splendid!",
    "Wonderful!",
    "Fabulous!",
    "Stunning!",
    "Phenomenal!",
    "Epic!",
  ];
  const phrase = phrases[(score ?? 0) % phrases.length];
  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:w-auto sm:min-w-[320px] max-w-md mx-3 mb-6 sm:mb-0 rounded-lg overflow-hidden border border-gray-200 bg-white shadow-xl">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="text-lg font-extrabold text-black">{phrase}</div>
          <div className="text-gray-600 text-sm">Your score</div>
        </div>
        <div className="px-5 py-6">
          <div className="text-5xl font-extrabold text-center text-black">{score ?? 0}</div>
        </div>
        <div className="px-5 pt-3 pb-5 flex flex-col sm:flex-row gap-3">
          {onPlayAgain && (
            <button type="button" className="btn btn-primary sm:flex-1" onClick={onPlayAgain}>
              Play Again
            </button>
          )}
          {onViewLeaderboard && (
            <button type="button" className="btn btn-outline sm:flex-1" onClick={onViewLeaderboard}>
              View Leaderboard
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
