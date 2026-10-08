import { Link } from "react-router";
import { type GameMeta } from "../../games";
import { getBest } from "../../platform/storage/bestScore";
import { brand, makersLine } from "../../config/brand";

type GameTileProps = {
  game: GameMeta;
  /** Small sticker on the cover, e.g. "New". */
  badge?: string;
  /** Above-the-fold tiles load their cover at once; the rest wait until scrolled near. */
  eager?: boolean;
};

/** One square on the home grid: cover, title, makers, and your best on this device. */
export default function GameTile({ game, badge, eager = false }: GameTileProps) {
  const best = getBest(game.id);

  return (
    <Link
      to={`/games/${game.id}`}
      className="card card-interactive block overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/50"
    >
      <div className="relative aspect-square bg-paper-2 border-b-2 border-edge">
        <img
          src={game.thumbnail || brand.logoMark}
          alt=""
          width={512}
          height={512}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="w-full h-full object-contain"
        />
        {badge && (
          <span className="absolute top-2 left-2 rounded-full border-2 border-edge bg-sun px-2 py-0.5 text-xs font-extrabold text-ink shadow-sticker">
            {badge}
          </span>
        )}
      </div>
      <div className="px-3 py-2">
        <h3 className="font-display text-base font-extrabold leading-tight text-ink truncate">
          {game.title}
        </h3>
        <p className="text-sm text-ink-2 truncate">by {makersLine(game.makers ?? brand.makers)}</p>
        <p className={`text-sm font-bold truncate ${best > 0 ? "text-brand" : "text-ink-3"}`}>
          {best > 0 ? `Your best: ${best.toLocaleString()}` : "New to you"}
        </p>
      </div>
    </Link>
  );
}
