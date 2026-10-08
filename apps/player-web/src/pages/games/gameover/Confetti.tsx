import type { CSSProperties } from "react";
import "./gameover.css";

const COLOURS = [
  "var(--color-sun)",
  "var(--color-tomato)",
  "var(--color-sky)",
  "var(--color-grass)",
  "var(--color-grape)",
];

/**
 * A one-shot CSS confetti burst from the top centre of its positioned parent.
 * Decorative only; hidden entirely when the player prefers reduced motion.
 */
export default function Confetti({ count = 18, delayS = 0 }: { count?: number; delayS?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: count }, (_, i) => {
        // Spread evenly round a half circle, with a fixed wobble so renders stay pure.
        const angle = Math.PI * (0.05 + (0.9 * i) / Math.max(1, count - 1));
        const reach = 70 + ((i * 37) % 50);
        const style = {
          "--dx": `${Math.round(Math.cos(angle) * reach * 1.6)}px`,
          "--dy": `${Math.round(-Math.sin(angle) * reach + 90)}px`,
          "--rot": `${(i * 97) % 360}deg`,
          background: COLOURS[i % COLOURS.length],
          animationDelay: `${delayS + (i % 4) * 0.04}s`,
        } as CSSProperties;
        return <span key={i} className="g4j-confetti-piece" style={style} />;
      })}
    </div>
  );
}
