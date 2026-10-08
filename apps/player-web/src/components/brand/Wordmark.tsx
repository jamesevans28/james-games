import { brand } from "../../config/brand";

// Crayon colours cycle across the letters, like a kid's poster title.
const LETTER_COLORS = ["text-tomato", "text-sun", "text-grass", "text-sky", "text-grape"];

type Props = { className?: string };

/** "Games4James" in the display font, one crayon colour per letter. */
export default function Wordmark({ className = "" }: Props) {
  return (
    <span
      className={`font-display font-extrabold tracking-tight [-webkit-text-stroke:1px_var(--color-edge)] [paint-order:stroke_fill] ${className}`}
      aria-label={brand.name}
      role="img"
    >
      {Array.from(brand.name).map((letter, i) => (
        <span key={i} aria-hidden className={LETTER_COLORS[i % LETTER_COLORS.length]}>
          {letter}
        </span>
      ))}
    </span>
  );
}
