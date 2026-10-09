import { Link } from "react-router";
import { brand } from "../../config/brand";
import { useDaily } from "./useDaily";

/** The "Today's challenge" card at the top of the home grid (T11.3). */
export default function TodayCard() {
  const { game, myRun } = useDaily();
  if (!game) return null;

  return (
    <Link
      to="/daily"
      className="card card-interactive mt-5 flex items-center gap-3 p-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/50"
    >
      <img
        src={game.thumbnail || brand.logoMark}
        alt=""
        width={64}
        height={64}
        decoding="async"
        className="h-16 w-16 shrink-0 rounded-xl border-2 border-edge bg-paper-2 object-contain"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold uppercase tracking-wide text-brand">
          Today&apos;s challenge
        </span>
        <span className="block truncate font-display text-lg font-extrabold leading-tight text-ink">
          {game.title}
        </span>
        <span className="block truncate text-sm font-semibold text-ink-2">
          {myRun
            ? `Your score today: ${myRun.score.toLocaleString()}`
            : "Same game for everyone today"}
        </span>
      </span>
      <span
        aria-hidden
        className="shrink-0 rounded-full border-2 border-edge bg-sun px-3 py-1 text-sm font-extrabold text-on-accent shadow-sticker"
      >
        {myRun ? "Board" : "Play"}
      </span>
    </Link>
  );
}
