import Sticker from "./stickers/Sticker";

type Props = {
  /** The sticker this run collected, e.g. "week-2026-41" (POST /scores `stickerEarned.id`). */
  stickerId: string;
  /** Seconds before it pops in, so it follows the XP bar. */
  delayS?: number;
};

/**
 * The weekly sticker moment (T7.5), shown on the game-over dialog when a run
 * collects this week's sticker (3 different days of play in one week). Always
 * happy: it never counts days or mentions missing one. The daily streak count
 * stays on the server and is not shown.
 */
export default function StreakCelebration({ stickerId, delayS = 0.4 }: Props) {
  return (
    <div
      role="status"
      className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-edge bg-sky/15 px-3 py-2 animate-bounce-in"
      style={{ animationDelay: `${delayS}s`, animationFillMode: "both" }}
    >
      <Sticker id={stickerId} size={64} className="shrink-0 -rotate-6" />
      <div className="text-left">
        <p className="font-display text-lg font-extrabold leading-tight text-ink">
          You got this week&apos;s sticker!
        </p>
        <p className="text-sm font-semibold text-ink-2">You played on 3 days this week.</p>
      </div>
    </div>
  );
}
