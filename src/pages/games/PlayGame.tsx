import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { games } from "../../games";
import GameHeader from "./GameHeader";
import { trackGameStart } from "../../utils/analytics";
// import NameDialog from "../../components/NameDialog";
import Seo from "../../components/Seo";
import GameLanding from "./GameLanding";
import ScoreDialog from "../../components/ScoreDialog";
import { onGameOver } from "../../utils/gameEvents";
import { useAuth } from "../../context/AuthProvider";
import RatingPromptModal from "../../components/RatingPromptModal";
import { fetchRatingSummary, submitRating, RatingSummary } from "../../lib/api";
import { getCachedRatingSummary, setCachedRatingSummary } from "../../utils/ratingCache";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";

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
  const { user } = useAuth();
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

  // Helper to mount the game immediately
  const mountGame = useCallback(async () => {
    if (mountingRef.current) return;
    mountingRef.current = true;
    setMounting(true);
    try {
      if (!meta) {
        setError("Game not found");
        return;
      }
      if (!containerRef.current) return;
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
    } catch (e) {
      console.error(e);
      setError("Failed to load game");
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

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      <Seo
        title={meta ? `${meta.title} — Play Free at Games4James` : "Play Free Games at Games4James"}
        description={
          meta?.description ||
          "Play free online games made by James. Fun, fast, skill-based games you can play instantly on your phone or browser."
        }
        url={`https://games4james.com/games/${meta?.id ?? ""}`}
        canonical={`https://games4james.com/games/${meta?.id ?? ""}`}
        image={meta?.thumbnail ? `https://games4james.com${meta.thumbnail}` : "/assets/logo.png"}
      />

      <GameHeader
        title={meta?.title ?? "Unknown Game"}
        leaderboardTo={meta ? `/leaderboard/${meta.id}` : undefined}
      />

      {error && <div className="p-4 text-red-400">{error}</div>}
      {!playing && meta && !error && <GameLanding meta={meta} onPlay={() => setPlaying(true)} />}

      {playing && (
        <div className="game-stage">
          <div
            ref={containerRef}
            id="game-container"
            className="relative w-full h-full overflow-hidden bg-black"
          />
          {mounting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-[1000]">
              <div className="flex flex-col items-center">
                <img
                  src="/assets/rocket-spinner.svg"
                  alt="Loading"
                  className="w-32 h-32 animate-pulse"
                />
                <div className="mt-4 text-white font-semibold tracking-[0.35em] text-sm">
                  LOADING
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ScoreDialog
        open={showScore}
        score={lastScore}
        gameId={meta?.id}
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
