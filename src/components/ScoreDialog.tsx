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
