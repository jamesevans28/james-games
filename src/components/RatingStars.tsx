import { useState } from "react";

type RatingStarsProps = {
  value: number;
  onSelect?: (rating: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
  className?: string;
};

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
  const px = size === "sm" ? 16 : 24;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = displayValue >= star;
        const shared = {
          className: "transition-transform",
        };
        if (!interactive) {
          return (
            <span key={star} {...shared}>
              <StarIcon filled={filled} size={px} />
            </span>
          );
        }
        return (
          <button
            type="button"
            key={star}
            {...shared}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(null)}
            onClick={() => onSelect?.(star)}
            className={`${shared.className} focus:outline-none`}
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          >
            <StarIcon filled={filled} size={px} />
          </button>
        );
      })}
    </div>
  );
}

function StarIcon({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "#FBBF24" : "none"}
      stroke={filled ? "#FBBF24" : "#D1D5DB"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.5l3.09 6.26 6.91.99-5 4.87 1.18 6.88L12 17.77 5.82 21.5l1.18-6.88-5-4.87 6.91-.99L12 2.5z" />
    </svg>
  );
}
