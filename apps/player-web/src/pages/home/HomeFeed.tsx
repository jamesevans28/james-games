import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Seo from "../../components/Seo";
import GameTile from "../../components/feed/GameTile";
import { games } from "../../games";
import { fetchRatingSummaries, RatingSummary } from "../../lib/api";
import { getCachedRatingSummary, primeRatingCache } from "../../utils/ratingCache";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { useFeedAlgorithm, FeedGame } from "../../hooks/useFeedAlgorithmV2";
import {
  buildWebsiteJsonLd,
  buildGameCollectionJsonLd,
  buildOrganizationJsonLd,
  SITE_KEYWORDS,
  SITE_URL,
} from "../../utils/seoKeywords";

const INITIAL_LOAD_COUNT = 5;
const LOAD_MORE_COUNT = 3;

export default function HomeFeed() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBetaTester = Boolean(user?.betaTester);

  const visibleGames = useMemo(() => {
    return isBetaTester ? games : games.filter((game) => !game.betaOnly);
  }, [isBetaTester]);

  const [ratings, setRatings] = useState<Record<string, RatingSummary>>(() => {
    const initial: Record<string, RatingSummary> = {};
    games.forEach((game) => {
      const cached = getCachedRatingSummary(game.id);
      if (cached) initial[game.id] = cached;
    });
    return initial;
  });

  // Load ratings
  useEffect(() => {
    let cancelled = false;
    const loadRatings = async () => {
      if (!visibleGames.length) return;
      try {
        const summaries = await fetchRatingSummaries(visibleGames.map((g) => g.id));
        if (cancelled) return;
        primeRatingCache(summaries);
        setRatings((prev) => {
          const next = { ...prev };
          summaries.forEach((summary) => {
            next[summary.gameId] = summary;
          });
          return next;
        });
      } catch (err) {
        console.warn("Failed to load ratings", err);
      }
    };
    loadRatings();
    const interval = setInterval(loadRatings, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [visibleGames]);

  usePresenceReporter({ status: "home", enabled: true });

  // Get algorithmically sorted feed
  const { games: feedGames, isLoading: isFeedLoading } = useFeedAlgorithm({
    games: visibleGames,
    ratings,
    isBetaTester,
  });

  // Infinite scroll state
  const [displayCount, setDisplayCount] = useState(INITIAL_LOAD_COUNT);
  const [cycleOffset, setCycleOffset] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get display items with infinite cycling
  const displayItems = useMemo((): FeedGame[] => {
    if (feedGames.length === 0) return [];

    const items: FeedGame[] = [];
    for (let i = 0; i < displayCount; i++) {
      const index = (i + cycleOffset) % feedGames.length;
      items.push(feedGames[index]);
    }
    return items;
  }, [feedGames, displayCount, cycleOffset]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && feedGames.length > 0) {
          setDisplayCount((prev) => prev + LOAD_MORE_COUNT);
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0,
      }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [feedGames.length]);

  // Handle when we've cycled through all games - reset and shuffle
  useEffect(() => {
    if (displayCount >= feedGames.length * 2 && feedGames.length > 0) {
      // When we've shown 2x the games, reset and offset to continue fresh
      setCycleOffset((prev) => (prev + feedGames.length) % feedGames.length);
      setDisplayCount(INITIAL_LOAD_COUNT + feedGames.length);
    }
  }, [displayCount, feedGames.length]);

  const getBadgeForGame = (game: FeedGame): string | undefined => {
    switch (game.feedReason) {
      case "beta":
        return "In dev";
      case "updated":
        return "Updated";
      case "new":
        return "New";
      case "user_recent":
        return "Continue";
      default:
        return undefined;
    }
  };

  // Skeleton loader component
  const GameTileSkeleton = () => (
    <article className="bg-surface-card border-b border-flingo-200/30 animate-pulse">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="h-5 bg-flingo-200 rounded-lg w-32 mb-2" />
        <div className="h-3 bg-flingo-100 rounded w-48" />
      </div>

      {/* Image placeholder */}
      <div className="w-full aspect-square bg-flingo-100" />

      {/* Stats row */}
      <div className="px-4 py-2 flex items-center justify-between bg-flingo-50/50">
        <div className="flex items-center gap-3">
          <div className="h-4 bg-flingo-200 rounded w-20" />
          <div className="h-3 bg-flingo-100 rounded w-16" />
        </div>
        <div className="w-8 h-8 bg-flingo-200 rounded-full" />
      </div>

      {/* Description */}
      <div className="px-4 py-3">
        <div className="h-4 bg-flingo-100 rounded w-full mb-2" />
        <div className="h-4 bg-flingo-100 rounded w-3/4" />
      </div>
    </article>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Seo
        title="Free Online Games for Kids & Families | Play Instantly at flingo.fun"
        description="Play free online games at flingo.fun! Kid-friendly, browser-based arcade and skill games. No download, no ads - just tap and play on any device!"
        url={`${SITE_URL}/`}
        canonical={`${SITE_URL}/`}
        image={`${SITE_URL}/assets/shared/logo_square.png`}
        keywords={SITE_KEYWORDS.join(", ")}
        jsonLd={[
          buildWebsiteJsonLd(),
          buildOrganizationJsonLd(),
          buildGameCollectionJsonLd(visibleGames),
        ]}
      />

      {/* Feed Container - Mobile-width centered */}
      <div
        ref={containerRef}
        className="w-full max-w-[540px] mx-auto bg-surface-dark min-h-screen shadow-xl border-x border-flingo-200/20"
      >
        {/* Welcome header */}
        <div className="sticky top-0 z-10 bg-surface-dark/95 backdrop-blur-xl border-b border-flingo-200/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-neon-lime text-glow-lime">For You</h1>
              <p className="text-xs text-flingo-600">
                {isFeedLoading ? "Loading..." : `${feedGames.length} games to explore`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/games-list")}
              className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide text-neon-lime bg-flingo-100 hover:bg-flingo-200 border border-neon-lime/30 hover:border-neon-lime/50 transition-all hover:shadow-neon-lime/20 hover:shadow-lg"
            >
              View all
            </button>
          </div>
        </div>

        {/* Loading skeletons */}
        {isFeedLoading && (
          <div className="divide-y divide-flingo-200/30">
            {Array.from({ length: 3 }).map((_, i) => (
              <GameTileSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Game Tiles Feed */}
        {!isFeedLoading && (
          <div className="divide-y divide-flingo-200/30">
            {displayItems.map((game, index) => (
              <GameTile
                key={`${game.id}-${index}`}
                game={game}
                rating={ratings[game.id]}
                badge={getBadgeForGame(game)}
              />
            ))}
          </div>
        )}

        {/* Load more trigger */}
        {!isFeedLoading && (
          <div ref={loadMoreRef} className="py-8 flex items-center justify-center">
            {feedGames.length > 0 && (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-flingo-400 border-t-neon-lime rounded-full animate-spin" />
                <p className="text-xs text-flingo-500">Loading more games...</p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!isFeedLoading && feedGames.length === 0 && (
          <div className="py-16 px-4 text-center">
            <p className="text-flingo-800 font-medium">No games available</p>
            <p className="text-sm text-flingo-500 mt-1">Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
