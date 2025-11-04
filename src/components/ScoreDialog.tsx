type Props = {
  open: boolean;
  score: number | null;
  onClose: () => void;
  onPlayAgain?: () => void;
  onViewLeaderboard?: () => void;
};

export default function ScoreDialog({
  open,
  score,
  onClose,
  onPlayAgain,
  onViewLeaderboard,
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:w-auto sm:min-w-[320px] max-w-md mx-3 mb-6 sm:mb-0 rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 shadow-2xl">
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-lg font-extrabold text-white">Nice run!</div>
          <div className="text-white/70 text-sm">Your score</div>
        </div>
        <div className="px-5 py-6">
          <div className="text-5xl font-extrabold text-center text-white drop-shadow-sm">
            {score ?? 0}
          </div>
        </div>
        <div className="px-5 pt-3 pb-5 flex flex-col sm:flex-row gap-3">
          {onPlayAgain && (
            <button
              type="button"
              className="sm:flex-1 py-3 rounded-full font-extrabold bg-gradient-to-r from-fuchsia-600 via-purple-600 to-sky-600 hover:from-fuchsia-500 hover:to-sky-500"
              onClick={onPlayAgain}
            >
              Play Again
            </button>
          )}
          {onViewLeaderboard && (
            <button
              type="button"
              className="sm:flex-1 py-3 rounded-full font-bold bg-white/10 hover:bg-white/20 border border-white/15"
              onClick={onViewLeaderboard}
            >
              View Leaderboard
            </button>
          )}
          <button
            type="button"
            className="px-4 py-3 rounded-full font-bold bg-white/10 hover:bg-white/20 border border-white/15"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
