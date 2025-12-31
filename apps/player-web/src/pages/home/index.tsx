import { useEffect, useState, useMemo } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Seo from "../../components/Seo";
import { games, GameMeta } from "../../games";
import { fetchRatingSummaries, RatingSummary } from "../../lib/api";
import { getCachedRatingSummary, primeRatingCache } from "../../utils/ratingCache";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { useAuth } from "../../context/FirebaseAuthProvider";
// import NameDialog from "../../components/NameDialog";
// useSession removed — currently not needed on the home page

const FEATURED_GAME_ID = "hoop-city";

export default function GameHub() {
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

  const randomGame = useMemo(() => {
    if (!visibleGames.length) return null;
    const index = Math.floor(Math.random() * visibleGames.length);
    return visibleGames[index] ?? null;
  }, [visibleGames]);

  // Filter games into curated buckets for the home experience
  const { recentDrops, recentlyUpdated, favouriteGames, evergreenGames, heroGame } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 4);

    const fresh: GameMeta[] = [];
    const updated: GameMeta[] = [];

    visibleGames.forEach((game) => {
      if (game.createdAt) {
        const createdDate = new Date(game.createdAt);
        if (!Number.isNaN(createdDate.getTime()) && createdDate >= cutoff) {
          fresh.push(game);
        }
      }
      if (game.updatedAt) {
        const updatedDate = new Date(game.updatedAt);
        if (!Number.isNaN(updatedDate.getTime()) && updatedDate >= cutoff) {
          updated.push(game);
        }
      }
    });

    fresh.sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );
    updated.sort(
      (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
    );

    const freshIds = new Set(fresh.map((g) => g.id));
    const uniqueUpdated = updated.filter((game) => !freshIds.has(game.id));

    const favs = [...visibleGames]
      .filter((g) => ratings[g.id] && typeof ratings[g.id].avgRating === "number")
      .sort((a, b) => (ratings[b.id].avgRating || 0) - (ratings[a.id].avgRating || 0))
      .slice(0, 2);

    const usedIds = new Set<string>([...freshIds, ...uniqueUpdated.map((g) => g.id)]);
    const evergreen = visibleGames
      .filter((game) => !usedIds.has(game.id))
      .sort((a, b) => {
        const scoreA = ratings[a.id]?.avgRating ?? 0;
        const scoreB = ratings[b.id]?.avgRating ?? 0;
        if (scoreA === scoreB) return a.title.localeCompare(b.title);
        return scoreB - scoreA;
      });

    const hero = fresh[0] ?? uniqueUpdated[0] ?? favs[0] ?? visibleGames[0] ?? null;

    return {
      recentDrops: fresh,
      recentlyUpdated: uniqueUpdated,
      favouriteGames: favs,
      evergreenGames: evergreen,
      heroGame: hero,
    };
  }, [ratings, visibleGames]);

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

  const featuredGame =
    visibleGames.find((g) => g.id === FEATURED_GAME_ID) ?? heroGame ?? visibleGames[0] ?? null;

  const heroRatingLine = featuredGame ? ratingSummaryLine(featuredGame.id) : null;
  const heroTimestamp = featuredGame
    ? formatRelativeLabel(
        featuredGame.updatedAt ?? featuredGame.createdAt,
        featuredGame.updatedAt ? "Updated" : "Added"
      )
    : null;

  const fallbackGameId = featuredGame?.id ?? randomGame?.id ?? visibleGames[0]?.id;
  const quickActions = [
    {
      title: "Invite friends",
      body: "Share your follow code or follow someone by theirs.",
      cta: "Open followers",
      action: () => navigate("/followers"),
    },
    // {
    //   title: "Leaderboards",
    //   body: "See the top scores for every game in one place.",
    //   cta: "View leaderboard",
    //   action: () => {
    //     if (leaderboardGameId) {
    //       navigate(`/leaderboard/${leaderboardGameId}`);
    //     }
    //   },
    // },
    {
      title: "Surprise me",
      body: randomGame
        ? `${randomGame.title} is calling your name.`
        : "Pick any game to get started.",
      cta: randomGame ? `Play ${randomGame.title}` : "Play a game",
      action: () => {
        if (randomGame?.id) {
          navigate(`/games/${randomGame.id}`);
        } else if (fallbackGameId) {
          navigate(`/games/${fallbackGameId}`);
        }
      },
    },
  ];

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
        className="relative bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => navigate(`/games/${game.id}`)}
      >
        {badge && (
          <span className="absolute top-2 left-2 z-10 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full bg-black/80 text-white">
            {badge}
          </span>
        )}
        <div
          className="aspect-square bg-cover bg-center"
          style={{ backgroundImage: `url(${game.thumbnail || "/assets/logo.png"})` }}
          title={game.title}
        />
        <div className="px-3 py-2">
          <h3 className="text-sm font-semibold truncate text-black">{game.title}</h3>
          {metaLine && (
            <p className="text-[11px] text-gray-500 uppercase tracking-wide mt-0.5">{metaLine}</p>
          )}
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill={summary ? "#F59E0B" : "none"}
              stroke="#F59E0B"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 2.5l3.09 6.26 6.91.99-5 4.87 1.18 6.88L12 17.77 5.82 21.5l1.18-6.88-5-4.87 6.91-.99L12 2.5z" />
            </svg>
            <span className="font-semibold text-black">
              {summary ? summary.avgRating.toFixed(1) : "—"}
            </span>
            <span className="text-gray-400">({summary?.ratingCount ?? 0})</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      <Seo
        title="Free Online Games | Play Skill, Reflex & Arcade Games at Games4James"
        description="Play free online games made by James! Fun, fast, skill-based games you can play instantly on your phone or browser. Join Games4James today and test your reflexes."
        url="https://games4james.com/"
        canonical="https://games4james.com/"
        image="https://games4james.com/assets/logo.png"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Games4James",
          url: "https://games4james.com/",
          description:
            "Play free online games made by James! Fun, fast, skill-based games you can play instantly on your phone or browser.",
          publisher: {
            "@type": "Person",
            name: "James",
          },
        }}
      />

      {featuredGame && (
        <section className="w-full bg-gradient-to-br from-emerald-50 via-white to-blue-50 border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex-1 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                Featured game
              </p>
              <h1 className="text-3xl font-extrabold text-black">{featuredGame.title}</h1>
              {featuredGame.description && (
                <p className="text-gray-600 text-sm leading-relaxed">{featuredGame.description}</p>
              )}
              {heroRatingLine && <p className="text-xs text-gray-500">{heroRatingLine}</p>}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-full bg-black text-white text-sm font-semibold"
                  onClick={() => navigate(`/games/${featuredGame.id}`)}
                >
                  Play now
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-full border border-black/20 text-sm font-semibold"
                  onClick={() => navigate(`/leaderboard/${featuredGame.id}`)}
                >
                  View leaderboard
                </button>
              </div>
            </div>
            <div
              className="flex-1 min-h-[220px] rounded-2xl border border-white/60 shadow-inner overflow-hidden relative"
              style={{
                backgroundImage: `url(${featuredGame.thumbnail || "/assets/logo.png"})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-black/50 to-transparent" />
              <div className="relative z-10 h-full flex items-end p-4">
                <div className="text-white text-sm font-semibold">
                  {heroTimestamp ?? "Now playing"}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="w-full max-w-6xl mx-auto px-4 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => (
            <button
              key={action.title}
              type="button"
              onClick={action.action}
              className="text-left rounded-2xl border border-gray-200 bg-white/80 shadow-sm p-4 hover:border-black/20 hover:-translate-y-0.5 transition-all"
            >
              <p className="text-sm font-semibold text-black">{action.title}</p>
              <p className="text-xs text-gray-500 mt-1">{action.body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                {action.cta}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12h14M13 5l7 7-7 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </button>
          ))}
        </div>
      </section>

      {isBetaTester && betaGames.length > 0 && (
        <HomeSection
          title="Games in development"
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
        </HomeSection>
      )}

      {recentlyUpdated.length > 0 && (
        <HomeSection
          title="Freshly updated"
          subtitle="Balance tweaks, new levels, and polish drops from this week."
        >
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {recentlyUpdated.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                badge="Updated"
                metaLine={formatRelativeLabel(game.updatedAt, "Updated")}
              />
            ))}
          </div>
        </HomeSection>
      )}

      {recentDrops.length > 0 && (
        <HomeSection title="New this week" subtitle="Brand-new releases that just landed.">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {recentDrops.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                badge="New"
                metaLine={formatRelativeLabel(game.createdAt, "Added")}
              />
            ))}
          </div>
        </HomeSection>
      )}

      {favouriteGames.length > 0 && (
        <HomeSection title="Fan favourites" subtitle="Highest-rated challenges from the community.">
          <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {favouriteGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                badge="Top rated"
                metaLine={ratingSummaryLine(game.id)}
              />
            ))}
          </div>
        </HomeSection>
      )}

      {evergreenGames.length > 0 && (
        <HomeSection title="Play anything" subtitle="Classic skill games you can always count on.">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {evergreenGames.map((game) => (
              <GameCard key={game.id} game={game} metaLine={ratingSummaryLine(game.id)} />
            ))}
          </div>
        </HomeSection>
      )}
    </div>
  );
}

function HomeSection({
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
        <h2 className="text-xl font-bold text-black">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
