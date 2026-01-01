import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { games } from "../../games";
import GameHeader from "./GameHeader";
import { trackGameStart } from "../../utils/analytics";
// import NameDialog from "../../components/NameDialog";
import Seo from "../../components/Seo";
import GameLanding from "./GameLanding";
import GameOver from "./GameOver";
import { onGameOver } from "../../utils/gameEvents";
import { useAuth } from "../../context/FirebaseAuthProvider";
import RatingPromptModal from "../../components/RatingPromptModal";
import { fetchRatingSummary, submitRating, RatingSummary } from "../../lib/api";
import { getCachedRatingSummary, setCachedRatingSummary } from "../../utils/ratingCache";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { recordGamePlayed } from "../../hooks/useFeedAlgorithm";
import {
  buildGameJsonLd,
  buildGameKeywords,
  getGameSeoDescription,
  SITE_URL,
} from "../../utils/seoKeywords";

const PLAY_COUNT_PREFIX = "rating:plays:";
const RATING_PROMPT_INTERVAL = 10;

function incrementPlayCounter(gameId: string) {
  if (typeof window === "undefined") return 0;
  const key = `${PLAY_COUNT_PREFIX}${gameId}`;
  const current = Number(window.localStorage.getItem(key) || 0);
  const next = current + 1;
  window.localStorage.setItem(key, String(next));
  return next;
}

export default function PlayGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const meta = useMemo(() => games.find((g) => g.id === gameId), [gameId]);
  const { user, ensureSession } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const destroyRef = useRef<null | (() => void)>(null);
  const mountingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [mounting, setMounting] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [pendingRatingTrigger, setPendingRatingTrigger] = useState(false);
  const [ratingPromptOpen, setRatingPromptOpen] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(() =>
    meta ? getCachedRatingSummary(meta.id) : null
  );
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [pendingPromptAction, setPendingPromptAction] = useState<"none" | "playAgain" | "close">(
    "none"
  );
  const [userRating, setUserRating] = useState<number | null>(null);
  const presenceStatus = showScore
    ? "in_score_dialog"
    : playing
    ? "playing"
    : meta
    ? "game_lobby"
    : "looking_for_game";
  usePresenceReporter({
    status: presenceStatus,
    gameId: meta?.id,
    gameTitle: meta?.title,
    enabled: !!meta,
  });

  useEffect(() => {
    if (!meta) {
      setRatingSummary(null);
      setUserRating(null);
      return;
    }
    const cached = getCachedRatingSummary(meta.id);
    setRatingSummary(cached);
    setUserRating(
      typeof cached?.userRating === "number" && !Number.isNaN(cached.userRating)
        ? cached.userRating
        : null
    );
  }, [meta]);

  useEffect(() => {
    if (!user) {
      setPendingRatingTrigger(false);
      setRatingPromptOpen(false);
    }
  }, [user]);

  useEffect(() => {
    // When entering a game route, opportunistically restore session if a refresh token exists.
    // This prevents long-idle users (expired access token) from silently losing score posts.
    if (!meta) return;
    if (user) return;
    void ensureSession({ silent: true, reason: "game-entry" });
  }, [meta, user, ensureSession]);

  // Helper to mount the game immediately
  const mountGame = useCallback(async () => {
    if (mountingRef.current) return;
    mountingRef.current = true;
    setMounting(true);
    setError(null);
    try {
      if (!meta) {
        setError("Game not found");
        return;
      }
      if (!containerRef.current) return;

      // Check if online before attempting to load (games are loaded on demand)
      if (!navigator.onLine) {
        setError("You're offline. Connect to the internet to load this game.");
        return;
      }

      const mod = await meta.load();
      // Destroy any previous instance first
      if (destroyRef.current) {
        try {
          destroyRef.current();
        } catch {}
        destroyRef.current = null;
      }
      const { destroy } = mod.mount(containerRef.current);
      destroyRef.current = destroy;
      trackGameStart(meta.id, meta.title);
      // Record this game as recently played for feed algorithm
      recordGamePlayed(meta.id);
    } catch (e) {
      console.error(e);
      // Check if it's a network error
      if (!navigator.onLine) {
        setError("You're offline. Connect to the internet to load this game.");
      } else {
        setError("Failed to load game. Please check your connection and try again.");
      }
    } finally {
      mountingRef.current = false;
      setMounting(false);
    }
  }, [meta]);

  const completePromptFlow = useCallback(() => {
    if (pendingPromptAction === "playAgain") {
      setPendingPromptAction("none");
      setPlaying(true);
      void mountGame();
    } else {
      setPendingPromptAction("none");
    }
  }, [pendingPromptAction, mountGame]);

  const openRatingPrompt = useCallback(
    async (nextAction: "none" | "playAgain" | "close") => {
      if (!meta || !user) return;
      setPendingRatingTrigger(false);
      setPendingPromptAction(nextAction);
      setRatingError(null);

      // If we already know the user has rated, skip showing the prompt.
      const knownUserRating = userRating ?? ratingSummary?.userRating ?? null;
      if (typeof knownUserRating === "number" && !Number.isNaN(knownUserRating)) {
        completePromptFlow();
        return;
      }

      // Otherwise fetch latest summary to confirm whether the prompt is needed
      setRatingLoading(true);
      try {
        const summary = await fetchRatingSummary(meta.id);
        setRatingSummary(summary);
        setCachedRatingSummary(summary);
        const fetchedUserRating =
          typeof summary.userRating === "number" && !Number.isNaN(summary.userRating)
            ? summary.userRating
            : null;
        setUserRating(fetchedUserRating);
        if (fetchedUserRating !== null) {
          // User has already rated — don't open the modal.
          completePromptFlow();
          return;
        }
        // No rating yet — show the prompt now
        setRatingPromptOpen(true);
      } catch (err) {
        console.error("Failed to load rating summary", err);
        setRatingError("Unable to load rating info right now.");
        // If we can't confirm, don't block the user — just continue their flow.
        completePromptFlow();
      } finally {
        setRatingLoading(false);
      }
    },
    [meta, user, userRating, ratingSummary?.userRating, completePromptFlow]
  );

  const handleRatingSkip = useCallback(() => {
    setRatingPromptOpen(false);
    setRatingError(null);
    completePromptFlow();
  }, [completePromptFlow]);

  const handleRatingSubmit = useCallback(
    async (value: number) => {
      if (!meta) return;
      setRatingSubmitting(true);
      setRatingError(null);
      try {
        const summary = await submitRating(meta.id, value);
        setRatingSummary(summary);
        setCachedRatingSummary(summary);
        setUserRating(summary.userRating ?? value);
        setRatingPromptOpen(false);
        completePromptFlow();
      } catch (err: any) {
        console.error("Failed to submit rating", err);
        if (err?.message === "signin_required") {
          setRatingError("Please sign in to rate this game.");
        } else {
          setRatingError("Unable to save your rating. Please try again later.");
        }
      } finally {
        setRatingSubmitting(false);
      }
    },
    [meta, completePromptFlow]
  );

  const handleCloseScore = () => {
    setShowScore(false);
    if (destroyRef.current) {
      try {
        destroyRef.current();
      } catch {}
      destroyRef.current = null;
    }
    setPlaying(false);
    if (pendingRatingTrigger && user) {
      void openRatingPrompt("close");
    } else {
      setPendingRatingTrigger(false);
    }
  };

  const handlePlayAgain = () => {
    setShowScore(false);
    if (pendingRatingTrigger && user) {
      void openRatingPrompt("playAgain");
      return;
    }
    setPlaying(true);
    void mountGame();
  };

  useEffect(() => {
    if (!meta) return;
    // Listen for game over and show score dialog over the running game
    const off = onGameOver((d) => {
      if (!meta || d.gameId !== meta.id) return;
      // Keep the game mounted so it's visible in the background
      setLastScore(d.score);
      setShowScore(true);
      if (user) {
        const count = incrementPlayCounter(meta.id);
        if (count > 0 && count % RATING_PROMPT_INTERVAL === 0) {
          const alreadyRated =
            typeof (userRating ?? ratingSummary?.userRating) === "number" &&
            !Number.isNaN(userRating ?? ratingSummary?.userRating);
          if (!alreadyRated) {
            setPendingRatingTrigger(true);
          }
        }
      }
    });
    return () => off?.();
  }, [meta, user, userRating, ratingSummary?.userRating]);

  useEffect(() => {
    let canceled = false;
    const doMount = async () => {
      if (!playing || canceled) return;
      await mountGame();
    };
    doMount();
    return () => {
      canceled = true;
      if (destroyRef.current) {
        try {
          destroyRef.current();
        } catch {}
        destroyRef.current = null;
      }
    };
  }, [playing, meta, mountGame]);

  const landingState = playing ? "hidden" : "visible";

  const jsonLd = useMemo(() => {
    if (!meta) return undefined;
    const baseJsonLd = buildGameJsonLd(meta);
    // Add aggregate rating if available
    if (ratingSummary?.avgRating && ratingSummary?.ratingCount) {
      return {
        ...baseJsonLd,
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: ratingSummary.avgRating,
          ratingCount: ratingSummary.ratingCount,
          bestRating: 5,
          worstRating: 1,
        },
      };
    }
    return baseJsonLd;
  }, [meta, ratingSummary]);

  const seoDescription = useMemo(() => {
    if (!meta)
      return "Play free online games at flingo.fun. Fun, fast, skill-based games you can play instantly on your phone or browser.";
    return getGameSeoDescription(meta.id, meta.description);
  }, [meta]);

  const seoKeywords = useMemo(() => {
    return meta ? buildGameKeywords(meta.id) : "";
  }, [meta]);

  return (
    <div className="min-h-screen bg-white text-flingo-800 flex flex-col">
      <Seo
        title={
          meta
            ? `${meta.title} — Free Online Game | Play Now at flingo.fun`
            : "Play Free Online Games at flingo.fun"
        }
        description={seoDescription}
        url={`${SITE_URL}/games/${meta?.id ?? ""}`}
        canonical={`${SITE_URL}/games/${meta?.id ?? ""}`}
        image={
          meta?.thumbnail
            ? `${SITE_URL}${meta.thumbnail}`
            : `${SITE_URL}/assets/shared/logo_square.png`
        }
        keywords={seoKeywords}
        ogType="game"
        articlePublishedTime={meta?.createdAt}
        articleModifiedTime={meta?.updatedAt}
        jsonLd={jsonLd}
      />

      <GameHeader
        title={meta?.title ?? "Unknown Game"}
        leaderboardTo={meta ? `/leaderboard/${meta.id}` : undefined}
        onBack={() => {
          if (playing) {
            setShowScore(false);
            setPendingRatingTrigger(false);
            setRatingPromptOpen(false);
            setRatingError(null);
            setLastScore(null);
            setPlaying(false);
            return;
          }
          navigate("/");
        }}
      />

      {error && <div className="p-4 text-red-400">{error}</div>}
      {meta && !error && (
        <div className="landing-panel" data-state={landingState} aria-hidden={playing}>
          <GameLanding meta={meta} onPlay={() => setPlaying(true)} />
        </div>
      )}

      {playing && (
        <div
          aria-hidden
          className="fixed inset-x-0 bottom-0 z-0 pointer-events-none bg-gradient-to-br from-fuchsia-700 via-flingo-700 to-fuchsia-700"
          style={{ top: "var(--header-h)" }}
        />
      )}

      <div
        className="game-stage z-10"
        data-state={playing ? "visible" : "hidden"}
        aria-hidden={!playing}
      >
        <div
          ref={containerRef}
          id="game-container"
          className="relative w-full h-full overflow-hidden bg-black"
        />
        {mounting && playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-[1000]">
            <div className="flex flex-col items-center">
              <img
                src="/assets/rocket-spinner.svg"
                alt="Loading"
                className="w-32 h-32 animate-pulse"
              />
              <div className="mt-4 text-white font-semibold tracking-[0.35em] text-sm">LOADING</div>
            </div>
          </div>
        )}
      </div>

      {meta && (
        <article className="prose prose-sm max-w-2xl mx-auto p-6 mt-8 mb-24 bg-flingo-50 border-2 border-flingo-100">
          <h1 className="text-2xl font-bold text-flingo-800 mb-4">{meta.title}</h1>

          <section className="mb-6">
            <h2 className="text-lg font-bold text-flingo-700 mb-2">About this Game</h2>
            <p className="text-flingo-600">{meta.description}</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-flingo-700 mb-2">How to Play</h2>
            <ul className="list-disc pl-5 text-flingo-600 space-y-2">
              <li>
                <span className="font-medium">Objective:</span>{" "}
                {meta.objective || "Score as high as possible."}
              </li>
              <li>
                <span className="font-medium">Controls:</span>{" "}
                {meta.controls || "Tap or click to interact."}
              </li>
            </ul>
          </section>
        </article>
      )}

      <GameOver
        open={showScore}
        score={lastScore}
        gameId={meta?.id}
        xpMultiplier={meta?.xpMultiplier}
        onClose={handleCloseScore}
        onPlayAgain={handlePlayAgain}
        onViewLeaderboard={meta ? () => navigate(`/leaderboard/${meta.id}`) : undefined}
      />

      <RatingPromptModal
        open={ratingPromptOpen}
        gameTitle={meta?.title ?? "Rate this game"}
        avgRating={ratingSummary?.avgRating}
        ratingCount={ratingSummary?.ratingCount}
        initialRating={userRating}
        loading={ratingLoading}
        submitting={ratingSubmitting}
        error={ratingError}
        onSubmit={handleRatingSubmit}
        onSkip={handleRatingSkip}
      />
    </div>
  );
}
