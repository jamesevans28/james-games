import { stickerMomentText } from "../../config/stickers";
import type { EarnedSticker } from "../../lib/api";
import Sticker from "./Sticker";

type Props = {
  /** Every sticker this run collected (POST /scores `stickersEarned`), weekly first. */
  stickers: readonly EarnedSticker[];
  /** Seconds before it pops in, so it follows the XP bar. */
  delayS?: number;
};

/**
 * The game-over sticker moment (T7.5, T11.4): every sticker this run collected,
 * popping in one after another. They go straight into the profile sticker book.
 */
export default function StickerMoment({ stickers, delayS = 0.4 }: Props) {
  if (stickers.length === 0) return null;
  const { title, detail } = stickerMomentText(stickers);
  return (
    <div
      role="status"
      className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-edge bg-sky/15 px-3 py-2 animate-bounce-in"
      style={{ animationDelay: `${delayS}s`, animationFillMode: "both" }}
    >
      <ul className="flex shrink-0 -space-x-4" aria-hidden={stickers.length > 1}>
        {stickers.slice(0, 4).map((s, i) => (
          <li
            key={s.id}
            className="animate-bounce-in"
            style={{ animationDelay: `${delayS + 0.15 * i}s`, animationFillMode: "both" }}
          >
            <Sticker
              id={s.id}
              size={stickers.length > 1 ? 52 : 64}
              className={i % 2 === 0 ? "-rotate-6" : "rotate-6"}
            />
          </li>
        ))}
      </ul>
      <div className="min-w-0 text-left">
        <p className="font-display text-lg font-extrabold leading-tight text-ink">{title}</p>
        <p className="text-sm font-semibold text-ink-2">{detail}</p>
      </div>
    </div>
  );
}
