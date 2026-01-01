import { useEffect, useState } from "react";
import RatingStars from "./RatingStars";

type RatingPromptModalProps = {
  open: boolean;
  gameTitle: string;
  avgRating?: number;
  ratingCount?: number;
  initialRating?: number | null;
  loading?: boolean;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (rating: number) => void;
  onSkip: () => void;
};

export default function RatingPromptModal({
  open,
  gameTitle,
  avgRating,
  ratingCount,
  initialRating = null,
  loading = false,
  submitting = false,
  error = null,
  onSubmit,
  onSkip,
}: RatingPromptModalProps) {
  const [value, setValue] = useState(initialRating ?? 0);

  useEffect(() => {
    if (open) setValue(initialRating ?? 0);
  }, [open, initialRating]);

  if (!open) return null;

  const disableSubmit = value <= 0 || submitting;

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center">
      <div className="absolute inset-0 bg-surface-dark/80 backdrop-blur-sm" onClick={onSkip} />
      <div className="relative w-full max-w-md mx-4 rounded-3xl bg-surface-card border border-flingo-200/30 shadow-card-hover p-6">
        <div className="text-center">
          <p className="text-sm uppercase tracking-wide text-flingo-600 font-semibold">
            Rate this game
          </p>
          <h3 className="text-2xl font-bold text-flingo-900 mt-1">{gameTitle}</h3>
        </div>

        <div className="mt-5 flex flex-col items-center gap-3">
          <RatingStars
            value={value}
            onSelect={(rating) => setValue(rating)}
            readOnly={loading || submitting}
            size="md"
          />
          {loading ? (
            <p className="text-sm text-flingo-600">Loading rating…</p>
          ) : (
            <p className="text-sm text-flingo-700">
              Average {avgRating?.toFixed(1) ?? "—"} ({ratingCount ?? 0} ratings)
            </p>
          )}
          {error && <p className="text-sm text-neon-pink text-center">{error}</p>}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={disableSubmit}
            onClick={() => onSubmit(value)}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
          <button type="button" className="btn btn-outline flex-1" onClick={onSkip}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
