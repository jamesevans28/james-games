import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { GameMeta } from "../../games";
import { RatingSummary } from "../../lib/api";
import { getLastPlayedGames } from "../../hooks/useFeedAlgorithm";

type GameTileProps = {
  game: GameMeta;
  rating?: RatingSummary | null;
  badge?: string;
  onShare?: (game: GameMeta) => void;
};

// Get best score for a game from localStorage
function getBestScore(gameId: string): number | null {
  try {
    const key = `best_score_${gameId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export default function GameTile({ game, rating, badge, onShare }: GameTileProps) {
  const navigate = useNavigate();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Generate an engaging prompt based on game state and data
  const engagingPrompt = useMemo(() => {
    const lastPlayed = getLastPlayedGames();
    const bestScore = getBestScore(game.id);
    const playedBefore = lastPlayed.includes(game.id);
    const isRecentlyPlayed = lastPlayed.indexOf(game.id) === 0;
    const ratingCount = rating?.ratingCount ?? 0;
    const avgRating = rating?.avgRating ?? 0;

    // Priority 1: User has played before - show their best score or encourage continuation
    if (bestScore !== null && bestScore > 0) {
      return { emoji: "🏆", text: `Your best: ${bestScore.toLocaleString()}` };
    }

    if (isRecentlyPlayed) {
      return { emoji: "🔄", text: "Just played • Play again?" };
    }

    if (playedBefore) {
      return { emoji: "✨", text: "Welcome back!" };
    }

    // Priority 2: Social proof from ratings
    if (avgRating >= 4.5 && ratingCount >= 5) {
      return { emoji: "⭐", text: `${avgRating.toFixed(1)} stars • Fan favorite!` };
    }

    if (ratingCount >= 10) {
      return { emoji: "🔥", text: `${ratingCount} ratings • Popular!` };
    }

    // Priority 3: New or updated games
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const createdAt = game.createdAt ? new Date(game.createdAt).getTime() : 0;
    const updatedAt = game.updatedAt ? new Date(game.updatedAt).getTime() : 0;

    const daysSinceCreation = (now - createdAt) / dayMs;
    const daysSinceUpdate = (now - updatedAt) / dayMs;

    if (daysSinceCreation <= 7) {
      return { emoji: "🆕", text: "Brand new • Try it first!" };
    }

    if (daysSinceUpdate <= 7 && updatedAt > createdAt) {
      return { emoji: "✨", text: "Just updated!" };
    }

    // Priority 4: Beta games
    if (game.betaOnly) {
      return { emoji: "🧪", text: "In development • Test it out!" };
    }

    // Default: Encouraging text
    return { emoji: "🎮", text: "Tap to play!" };
  }, [game, rating]);

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
      text: game.description || `Check out ${game.title} on flingo.fun!`,
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
    navigate(`/games/${game.id}`);
  };

  const dateLabel = formatDateLabel();

  return (
    <article className="bg-surface-card border-b border-flingo-200/30 group/tile">
      {/* Header: Title + Engaging Prompt */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-flingo-900 truncate">{game.title}</h2>
              {badge && (
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-gradient-to-r from-neon-lime to-neon-blue text-surface-dark">
                  {badge}
                </span>
              )}
            </div>
            {/* Engaging prompt instead of date */}
            <p className="text-xs text-flingo-600 mt-0.5 font-medium">
              {engagingPrompt.emoji} {engagingPrompt.text}
            </p>
          </div>
        </div>
      </div>

      {/* Game Image - Tappable to play */}
      <button
        type="button"
        onClick={handlePlayClick}
        className="w-full aspect-square bg-flingo-100 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-inset focus:ring-neon-lime group"
      >
        <img
          src={game.thumbnail || "/assets/shared/flingo-logo.svg"}
          alt={game.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 group-active:scale-100"
          loading="lazy"
        />
        {/* Play overlay on hover/tap */}
        <div className="absolute inset-0 bg-surface-dark/0 group-hover:bg-surface-dark/40 transition-colors flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-neon-lime flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-neon-lime transform group-hover:scale-100 scale-75">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-surface-dark ml-1"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </button>

      {/* Stats Row: Rating + Date + Share - Snug against image */}
      <div className="px-4 py-2 flex items-center justify-between bg-flingo-50/50">
        <div className="flex items-center gap-3">
          {/* Rating */}
          <div className="flex items-center gap-1">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={rating?.ratingCount ? "#ffeb3b" : "none"}
              stroke="#ffeb3b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 2.5l3.09 6.26 6.91.99-5 4.87 1.18 6.88L12 17.77 5.82 21.5l1.18-6.88-5-4.87 6.91-.99L12 2.5z" />
            </svg>
            <span className="font-bold text-sm text-flingo-900">
              {rating?.avgRating ? rating.avgRating.toFixed(1) : "—"}
            </span>
            <span className="text-xs text-flingo-500">({rating?.ratingCount ?? 0})</span>
          </div>

          {/* Date divider */}
          {dateLabel && (
            <>
              <span className="text-flingo-400">•</span>
              <span className="text-xs text-flingo-500">{dateLabel}</span>
            </>
          )}
        </div>

        {/* Share button */}
        <button
          type="button"
          onClick={handleShare}
          className="w-8 h-8 rounded-full flex items-center justify-center text-flingo-600 hover:bg-flingo-100 hover:text-neon-lime transition-colors focus:outline-none focus:ring-2 focus:ring-neon-lime/50"
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
            <p className="text-sm text-flingo-700 line-clamp-1">
              {game.description || "Tap to play this game!"}{" "}
              <span className="text-neon-lime group-hover:text-neon-blue transition-colors">
                more
              </span>
            </p>
          ) : (
            <div className="space-y-3">
              {game.description && <p className="text-sm text-flingo-700">{game.description}</p>}
              {game.objective && (
                <div>
                  <p className="text-xs font-semibold text-neon-lime uppercase tracking-wide">
                    Objective
                  </p>
                  <p className="text-sm text-flingo-600 mt-0.5">{game.objective}</p>
                </div>
              )}
              {game.controls && (
                <div>
                  <p className="text-xs font-semibold text-neon-blue uppercase tracking-wide">
                    How to Play
                  </p>
                  <p className="text-sm text-flingo-600 mt-0.5">{game.controls}</p>
                </div>
              )}
              <p className="text-xs text-flingo-500 group-hover:text-neon-pink transition-colors">
                tap to collapse
              </p>
            </div>
          )}
        </button>
      </div>
    </article>
  );
}
