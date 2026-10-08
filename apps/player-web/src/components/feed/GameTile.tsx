import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { type GameMeta } from "../../games";
import { type RatingSummary } from "../../lib/api";
import { getLastPlayedGames } from "../../utils/playHistory";
import { getBest } from "../../utils/bestScore";
import { brand } from "../../config/brand";

type GameTileProps = {
  game: GameMeta;
  rating?: RatingSummary | null;
  badge?: string;
  onShare?: (game: GameMeta) => void;
};

export default function GameTile({ game, rating, badge, onShare }: GameTileProps) {
  const navigate = useNavigate();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // One plain status line: the player's best, or whether they've tried it.
  // (New/Updated/Continue come from the feed badge.)
  const statusLine = useMemo(() => {
    const bestScore = getBest(game.id);
    if (bestScore > 0) return `Your best: ${bestScore.toLocaleString()}`;
    if (getLastPlayedGames().includes(game.id)) return "Played before";
    if (game.betaOnly) return "Still being made";
    return "Not played yet";
  }, [game]);

  const formatDateLabel = () => {
    const updatedAt = game.updatedAt ? new Date(game.updatedAt) : null;
    const createdAt = game.createdAt ? new Date(game.createdAt) : null;

    if (!updatedAt && !createdAt) return null;

    const showUpdated =
      updatedAt &&
      createdAt &&
      updatedAt.getTime() > createdAt.getTime() &&
      updatedAt.getTime() !== createdAt.getTime();

    const dateToUse = showUpdated ? updatedAt : createdAt;
    const prefix = showUpdated ? "Updated" : "Released";

    if (!dateToUse || Number.isNaN(dateToUse.getTime())) return null;

    const diffDays = Math.floor((Date.now() - dateToUse.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return `${prefix} today`;
    if (diffDays === 1) return `${prefix} yesterday`;
    if (diffDays < 7) return `${prefix} ${diffDays}d ago`;
    if (diffDays < 30) return `${prefix} ${Math.floor(diffDays / 7)}w ago`;

    return `${prefix} ${dateToUse.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })}`;
  };

  const handleShare = useCallback(async () => {
    if (onShare) {
      onShare(game);
      return;
    }

    const shareUrl = `${window.location.origin}/games/${game.id}`;
    const shareData = {
      title: game.title,
      text: game.description || `Play ${game.title} on ${brand.name}!`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.warn("Share failed:", err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch (err) {
        console.warn("Copy failed:", err);
      }
    }
  }, [game, onShare]);

  const handlePlayClick = () => {
    void navigate(`/games/${game.id}`);
  };

  const dateLabel = formatDateLabel();

  return (
    <article className="bg-card border-b border-line group/tile">
      {/* Header: Title + Engaging Prompt */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink truncate">{game.title}</h2>
              {badge && (
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-gradient-to-r from-brand to-sky text-on-brand">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-ink-2 mt-0.5 font-semibold">{statusLine}</p>
          </div>
        </div>
      </div>

      {/* Game Image - Tappable to play */}
      <button
        type="button"
        onClick={handlePlayClick}
        className="w-full aspect-square bg-paper-2 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand group"
      >
        <img
          src={game.thumbnail || brand.logoMark}
          alt={game.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 group-active:scale-100"
          loading="lazy"
        />
        {/* Play overlay on hover/tap */}
        <div className="absolute inset-0 bg-scrim/0 group-hover:bg-scrim/40 transition-colors flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sticker transform group-hover:scale-100 scale-75">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-on-brand ml-1"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </button>

      {/* Stats Row: Rating + Date + Share - Snug against image */}
      <div className="px-4 py-2 flex items-center justify-between bg-paper-2">
        <div className="flex items-center gap-3">
          {/* Rating */}
          <div className="flex items-center gap-1">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={rating?.ratingCount ? "var(--color-sun)" : "none"}
              stroke="var(--color-sun)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 2.5l3.09 6.26 6.91.99-5 4.87 1.18 6.88L12 17.77 5.82 21.5l1.18-6.88-5-4.87 6.91-.99L12 2.5z" />
            </svg>
            <span className="font-bold text-sm text-ink">
              {rating?.avgRating ? rating.avgRating.toFixed(1) : "—"}
            </span>
            <span className="text-xs text-ink-3">({rating?.ratingCount ?? 0})</span>
          </div>

          {/* Date divider */}
          {dateLabel && (
            <>
              <span className="text-ink-3">•</span>
              <span className="text-xs text-ink-3">{dateLabel}</span>
            </>
          )}
        </div>

        {/* Share button */}
        <button
          type="button"
          onClick={handleShare}
          className="w-8 h-8 rounded-full flex items-center justify-center text-ink-2 hover:bg-paper-2 hover:text-brand transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50"
          aria-label={`Share ${game.title}`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      </div>

      {/* Description - Expandable */}
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={() => setDescriptionExpanded(!descriptionExpanded)}
          className="text-left w-full focus:outline-none group"
        >
          {!descriptionExpanded ? (
            <p className="text-sm text-ink-2 line-clamp-1">
              {game.description || "Tap to play this game!"}{" "}
              <span className="text-brand group-hover:text-sky transition-colors">more</span>
            </p>
          ) : (
            <div className="space-y-3">
              {game.description && <p className="text-sm text-ink-2">{game.description}</p>}
              {game.objective && (
                <div>
                  <p className="text-xs font-semibold text-brand uppercase tracking-wide">
                    Objective
                  </p>
                  <p className="text-sm text-ink-2 mt-0.5">{game.objective}</p>
                </div>
              )}
              {game.controls && (
                <div>
                  <p className="text-xs font-semibold text-sky uppercase tracking-wide">
                    How to Play
                  </p>
                  <p className="text-sm text-ink-2 mt-0.5">{game.controls}</p>
                </div>
              )}
              <p className="text-xs text-ink-3 group-hover:text-grape transition-colors">
                tap to collapse
              </p>
            </div>
          )}
        </button>
      </div>
    </article>
  );
}
