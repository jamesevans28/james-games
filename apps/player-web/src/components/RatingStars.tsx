import { useState } from "react";

type RatingStarsProps = {
  value: number;
  onSelect?: (rating: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
  className?: string;
};

/** Five stars. Read-only it's one labelled image; interactive, each star is a 44 px button. */
export default function RatingStars({
  value,
  onSelect,
  readOnly = false,
  size = "md",
  className = "",
}: RatingStarsProps) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = !!onSelect && !readOnly;
  const displayValue = hover ?? value;
  const px = size === "sm" ? 16 : 28;

  if (!interactive) {
    return (
      <div
        className={`flex items-center gap-0.5 ${className}`}
        role="img"
        aria-label={`${Math.round(value * 10) / 10} out of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon key={star} filled={displayValue >= star - 0.25} size={px} />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`} role="group" aria-label="Your stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(star)}
          onBlur={() => setHover(null)}
          onClick={() => onSelect?.(star)}
          className="flex h-11 w-11 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          aria-pressed={value === star}
        >
          <StarIcon filled={displayValue >= star} size={px} />
        </button>
      ))}
    </div>
  );
}

function StarIcon({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "var(--color-sun)" : "none"}
      stroke={filled ? "var(--color-edge)" : "var(--color-ink-3)"}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2.5l3.09 6.26 6.91.99-5 4.87 1.18 6.88L12 17.77 5.82 21.5l1.18-6.88-5-4.87 6.91-.99L12 2.5z" />
    </svg>
  );
}
