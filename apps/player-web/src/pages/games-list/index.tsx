import { useEffect, useState, useMemo } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import Seo from "../../components/Seo";
import { games, type GameMeta } from "../../games";
import { fetchRatingSummaries, type RatingSummary } from "../../lib/api";
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
import { brand, makersLine } from "../../config/brand";

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
        className="relative bg-card rounded-2xl border border-line overflow-hidden cursor-pointer hover:border-brand/30 hover:shadow-card-hover transition-all active:scale-[0.98]"
        onClick={() => navigate(`/games/${game.id}`)}
      >
        {badge && (
          <span className="absolute top-2 left-2 z-10 inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-full bg-gradient-to-r from-brand to-sky text-on-brand shadow-sm">
            {badge}
          </span>
        )}
        <div
          className="aspect-square bg-cover bg-center bg-paper-2"
          style={{ backgroundImage: `url(${game.thumbnail || brand.logoMark})` }}
          title={game.title}
        />
        <div className="px-3 py-3">
          <h3 className="text-sm font-bold truncate text-ink">{game.title}</h3>
          {metaLine && (
            <p className="text-[11px] text-brand uppercase tracking-wide mt-0.5 font-medium">
              {metaLine}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-1 text-xs text-ink-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={summary ? "var(--color-sun)" : "none"}
              stroke="var(--color-sun)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 2.5l3.09 6.26 6.91.99-5 4.87 1.18 6.88L12 17.77 5.82 21.5l1.18-6.88-5-4.87 6.91-.99L12 2.5z" />
            </svg>
            <span className="font-bold text-ink">
              {summary ? summary.avgRating.toFixed(1) : "—"}
            </span>
            <span className="text-ink-3">({summary?.ratingCount ?? 0})</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Seo
        title={`All games | ${brand.name}`}
        description={`Every game on ${brand.name}: little arcade, word and puzzle games made by ${makersLine()}. Free, no ads, no download.`}
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
      <section className="w-full bg-paper border-b border-line relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-grape/10 rounded-full blur-[80px]" />
        <div className="max-w-6xl mx-auto px-4 py-6 relative z-10">
          <h1 className="text-2xl font-extrabold text-brand">All Games</h1>
          <p className="text-sm text-ink-2 mt-1">
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
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-ink-2 mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
