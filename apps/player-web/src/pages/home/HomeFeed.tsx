import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import Seo from "../../components/Seo";
import GameTile from "../../components/feed/GameTile";
import { games } from "../../games";
import { fetchRatingSummaries, type RatingSummary } from "../../lib/api";
import { getCachedRatingSummary, primeRatingCache } from "../../utils/ratingCache";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { useFeedAlgorithm, type FeedGame } from "../../hooks/useFeedAlgorithmV2";
import {
  buildWebsiteJsonLd,
  buildGameCollectionJsonLd,
  buildOrganizationJsonLd,
  SITE_KEYWORDS,
  SITE_URL,
} from "../../utils/seoKeywords";
import { brand } from "../../config/brand";

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
    <article className="bg-card border-b border-line animate-pulse">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="h-5 bg-line rounded-lg w-32 mb-2" />
        <div className="h-3 bg-paper-2 rounded w-48" />
      </div>

      {/* Image placeholder */}
      <div className="w-full aspect-square bg-paper-2" />

      {/* Stats row */}
      <div className="px-4 py-2 flex items-center justify-between bg-paper-2">
        <div className="flex items-center gap-3">
          <div className="h-4 bg-line rounded w-20" />
          <div className="h-3 bg-paper-2 rounded w-16" />
        </div>
        <div className="w-8 h-8 bg-line rounded-full" />
      </div>

      {/* Description */}
      <div className="px-4 py-3">
        <div className="h-4 bg-paper-2 rounded w-full mb-2" />
        <div className="h-4 bg-paper-2 rounded w-3/4" />
      </div>
    </article>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Seo
        title={`${brand.name} | ${brand.tagline}`}
        description={brand.description}
        url={`${SITE_URL}/`}
        canonical={`${SITE_URL}/`}
        image={`${SITE_URL}${brand.ogImage}`}
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
        className="w-full max-w-[540px] mx-auto bg-paper min-h-screen shadow-xl border-x border-line"
      >
        {/* Welcome header */}
        <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur-xl border-b border-line px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-brand">For You</h1>
              <p className="text-xs text-ink-2">
                {isFeedLoading ? "Loading..." : `${feedGames.length} games to explore`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/games-list")}
              className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide text-brand bg-paper-2 hover:bg-line border border-brand/30 hover:border-brand/50 transition-all hover:shadow-sticker hover:shadow-lg"
            >
              View all
            </button>
          </div>
        </div>

        {/* Loading skeletons */}
        {isFeedLoading && (
          <div className="divide-y divide-line">
            {Array.from({ length: 3 }).map((_, i) => (
              <GameTileSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Game Tiles Feed */}
        {!isFeedLoading && (
          <div className="divide-y divide-line">
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
                <div className="w-6 h-6 border-2 border-ink-3 border-t-brand rounded-full animate-spin" />
                <p className="text-xs text-ink-3">Loading more games...</p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!isFeedLoading && feedGames.length === 0 && (
          <div className="py-16 px-4 text-center">
            <p className="text-ink font-medium">No games available</p>
            <p className="text-sm text-ink-3 mt-1">Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
