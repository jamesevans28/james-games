import { useEffect, useState, useMemo } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Seo from "../../components/Seo";
import { games, GameMeta } from "../../games";
import { fetchRatingSummaries, RatingSummary } from "../../lib/api";
import { getCachedRatingSummary, primeRatingCache } from "../../utils/ratingCache";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { useAuth } from "../../context/FirebaseAuthProvider";
import {
  buildWebsiteJsonLd,
  buildGameCollectionJsonLd,
  buildOrganizationJsonLd,
  SITE_KEYWORDS,
  SITE_URL,
} from "../../utils/seoKeywords";

export default function GamesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isBetaTester = Boolean(user?.betaTester);
  const visibleGames = useMemo(() => {
    return isBetaTester ? games : games.filter((game) => !game.betaOnly);
  }, [isBetaTester]);
  const betaGames = useMemo(() => games.filter((game) => game.betaOnly), []);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>(() => {
    const initial: Record<string, RatingSummary> = {};
    games.forEach((game) => {
      const cached = getCachedRatingSummary(game.id);
      if (cached) initial[game.id] = cached;
    });
    return initial;
  });

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

  usePresenceReporter({ status: "looking_for_game", enabled: true });

  const formatRelativeLabel = (iso?: string | null, prefix = "Updated") => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return `${prefix} today`;
    if (diffDays === 1) return `${prefix} yesterday`;
    if (diffDays < 7) return `${prefix} ${diffDays}d ago`;
    return `${prefix} ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  };

  const ratingSummaryLine = (gameId: string) => {
    const summary = ratings[gameId];
    if (!summary) return null;
    if (!summary.ratingCount) return "Be the first to rate";
    return `${summary.avgRating?.toFixed(1) ?? "-"} avg · ${summary.ratingCount} ratings`;
  };

  // Sort games by rating, then alphabetically
  const sortedGames = useMemo(() => {
    return [...visibleGames].sort((a, b) => {
      const scoreA = ratings[a.id]?.avgRating ?? 0;
      const scoreB = ratings[b.id]?.avgRating ?? 0;
      if (scoreA === scoreB) return a.title.localeCompare(b.title);
      return scoreB - scoreA;
    });
  }, [visibleGames, ratings]);

  const GameCard = ({
    game,
    badge,
    metaLine,
  }: {
    game: GameMeta;
    badge?: string;
    metaLine?: string | null;
  }) => {
    const summary = ratings[game.id];
    return (
      <div
        className="relative bg-white rounded-2xl border-2 border-flingo-100 overflow-hidden cursor-pointer hover:border-flingo-300 hover:shadow-fun transition-all active:scale-[0.98]"
        onClick={() => navigate(`/games/${game.id}`)}
      >
        {badge && (
          <span className="absolute top-2 left-2 z-10 inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full bg-gradient-to-r from-flingo-500 to-flingo-700 text-white shadow-sm">
            {badge}
          </span>
        )}
        <div
          className="aspect-square bg-cover bg-center bg-flingo-50"
          style={{ backgroundImage: `url(${game.thumbnail || "/assets/shared/flingo-logo.svg"})` }}
          title={game.title}
        />
        <div className="px-3 py-3">
          <h3 className="text-sm font-bold truncate text-flingo-900">{game.title}</h3>
          {metaLine && (
            <p className="text-[11px] text-flingo-500 uppercase tracking-wide mt-0.5 font-medium">
              {metaLine}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-1 text-xs text-flingo-600">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={summary ? "#FBBF24" : "none"}
              stroke="#FBBF24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 2.5l3.09 6.26 6.91.99-5 4.87 1.18 6.88L12 17.77 5.82 21.5l1.18-6.88-5-4.87 6.91-.99L12 2.5z" />
            </svg>
            <span className="font-bold text-flingo-800">
              {summary ? summary.avgRating.toFixed(1) : "—"}
            </span>
            <span className="text-flingo-400">({summary?.ratingCount ?? 0})</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Seo
        title="All Games - Browse Free Online Games | flingo.fun"
        description="Browse all free online games at flingo.fun! Kid-friendly, browser-based arcade and skill games. No download, no ads - just tap and play on any device!"
        url={`${SITE_URL}/games-list`}
        canonical={`${SITE_URL}/games-list`}
        image={`${SITE_URL}/assets/shared/logo_square.png`}
        keywords={[...SITE_KEYWORDS, "game catalog", "all games", "browse games"].join(", ")}
        jsonLd={[
          buildWebsiteJsonLd(),
          buildOrganizationJsonLd(),
          buildGameCollectionJsonLd(visibleGames),
        ]}
      />

      {/* Page header */}
      <section className="w-full bg-gradient-to-br from-flingo-100 via-white to-candy-pink/10 border-b-2 border-flingo-100">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-extrabold text-flingo-900">All Games</h1>
          <p className="text-sm text-flingo-600 mt-1">
            Browse our complete collection of {visibleGames.length} free games
          </p>
        </div>
      </section>

      {/* Beta games section for beta testers */}
      {isBetaTester && betaGames.length > 0 && (
        <GamesSection
          title="Games in Development"
          subtitle="Early builds just for beta testers. Expect bugs and share feedback!"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {betaGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                badge="In dev"
                metaLine={formatRelativeLabel(game.updatedAt, "Updated") ?? "Testing build"}
              />
            ))}
          </div>
        </GamesSection>
      )}

      {/* All games grid */}
      <GamesSection title="All Games" subtitle="Sorted by rating. Tap any game to play!">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {sortedGames.map((game) => (
            <GameCard key={game.id} game={game} metaLine={ratingSummaryLine(game.id)} />
          ))}
        </div>
      </GamesSection>
    </div>
  );
}

function GamesSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-flingo-900">{title}</h2>
        {subtitle && <p className="text-sm text-flingo-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
