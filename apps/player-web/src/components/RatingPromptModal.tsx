import { useEffect, useId, useState } from "react";
import RatingStars from "./RatingStars";

type RatingPromptModalProps = {
  open: boolean;
  gameTitle: string;
  initialRating?: number | null;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (rating: number) => void;
  onSkip: () => void;
};

/**
 * "Do you like it?" Shown only by the game landing page (useRatingPrompt decides when).
 */
export default function RatingPromptModal({
  open,
  gameTitle,
  initialRating = null,
  submitting = false,
  error = null,
  onSubmit,
  onSkip,
}: RatingPromptModalProps) {
  const [value, setValue] = useState(initialRating ?? 0);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onSkip]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="absolute inset-0 bg-scrim/70" onClick={onSkip} aria-hidden />
      <div className="card relative mx-4 w-full max-w-sm p-6 text-center">
        <h2 id={titleId} className="font-display text-2xl font-extrabold text-ink">
          Do you like {gameTitle}?
        </h2>
        <p className="mt-1 text-base text-ink-2">Tap the stars to tell us.</p>

        <div className="mt-4 flex justify-center">
          <RatingStars value={value} onSelect={setValue} readOnly={submitting} />
        </div>
        {error && <p className="mt-2 text-sm font-semibold text-tomato">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button type="button" className="btn btn-outline flex-1" onClick={onSkip}>
            Not now
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            disabled={value <= 0 || submitting}
            onClick={() => onSubmit(value)}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
