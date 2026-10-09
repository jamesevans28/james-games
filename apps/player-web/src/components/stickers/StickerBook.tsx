import { WEEKLY_ART, WEEKLY_HINT, stickerBook } from "../../config/stickers";
import Sticker from "./Sticker";

type Props = {
  /** Every sticker id the player has collected (GET /users/stickers). */
  collected: readonly string[];
};

/**
 * Your own sticker book (T11.4): the stickers you have, in colour, and the ones
 * still to get, greyed out with how to get them. Only shown on your own profile.
 */
export default function StickerBook({ collected }: Props) {
  const { achievements, weekly } = stickerBook(collected);
  const earned = achievements.filter((a) => a.earned).length;

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-ink-2">
        {earned === 0
          ? "Play to fill your book. Here's what you can collect!"
          : `You have ${earned} of ${achievements.length}. Keep going!`}
      </p>
      <ul className="grid grid-cols-3 gap-3">
        {achievements.map((a) => (
          <li key={a.id} className="flex flex-col items-center text-center">
            {a.earned ? (
              <Sticker id={a.id} size={60} />
            ) : (
              <img
                src={a.art.src}
                alt=""
                width={60}
                height={60}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="select-none opacity-35 grayscale"
              />
            )}
            <span
              className={`mt-1 text-sm font-bold leading-tight ${a.earned ? "text-ink" : "text-ink-2"}`}
            >
              {a.label}
              {!a.earned && <span className="sr-only"> (not yet)</span>}
            </span>
            {!a.earned && <span className="mt-0.5 text-xs leading-snug text-ink-2">{a.hint}</span>}
          </li>
        ))}
      </ul>

      <div>
        <h3 className="mb-2 text-base font-bold text-ink">Weekly stickers</h3>
        {weekly.length === 0 ? (
          <div className="flex items-center gap-3">
            <img
              src={WEEKLY_ART[0]!.src}
              alt=""
              width={48}
              height={48}
              draggable={false}
              className="select-none opacity-35 grayscale"
            />
            <p className="text-sm text-ink-2">{WEEKLY_HINT} to get one.</p>
          </div>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {weekly.map((id) => (
              <li key={id}>
                <Sticker id={id} size={48} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
