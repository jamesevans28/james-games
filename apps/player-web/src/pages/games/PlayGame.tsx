import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { allGames } from "../../games";
import { createHost } from "../../platform/host";
import { onMutedChange } from "../../platform/audio";
import type { GameInstance } from "../../platform/sdk";
import GameHeader from "./GameHeader";
// import NameDialog from "../../components/NameDialog";
import Seo from "../../components/Seo";
import GameLanding from "./GameLanding";
import GameOver from "./GameOver";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { useGameRatings } from "../../hooks/useGameRatings";
import { recordPlay } from "../../lib/ratingPrompt";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { recordGamePlayed } from "../../utils/playHistory";
import { getBest } from "../../platform/storage/bestScore";
import {
  buildGameJsonLd,
  getGameSeoDescription,
  shareImageFor,
  SITE_URL,
} from "../../utils/seoKeywords";
import { brand } from "../../config/brand";
import { adapters } from "../../platform/adapters";

export default function PlayGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  // Deliberately the bundled registry, not the live catalog: the mount effect depends
  // on `meta`, so a new object when catalog data arrives would remount a running game.
  const meta = useMemo(() => allGames.find((g) => g.id === gameId), [gameId]);
  const { user, ensureSession } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const destroyRef = useRef<null | (() => void)>(null);
  // SDK games (T4.4): the running instance, so "Play again" restarts instead of remounting.
  const instanceRef = useRef<GameInstance | null>(null);
  const [paused, setPaused] = useState(false);
  const [runsFinished, setRunsFinished] = useState(0);
  // The host records the finished run here; an effect further down reacts with current state.
  const [finishedRun, setFinishedRun] = useState<{ score: number; durationMs?: number } | null>(
    null,
  );

  const mountingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [mounting, setMounting] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  // Best on this device before the current run. Games save a new best before they
  // report game over, so it is captured while the score dialog is closed.
  const [previousBest, setPreviousBest] = useState(0);
  const [lastDurationMs, setLastDurationMs] = useState<number | undefined>(undefined);
  // For the page's structured data only; the landing page owns rating UI and the prompt (T7.4).
  const { summary: ratingSummary } = useGameRatings(meta?.id);
  useEffect(() => {
    if (!showScore && meta) setPreviousBest(getBest(meta.id));
  }, [showScore, meta]);

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
    enabled: !!meta,
  });

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

      // No online check here: games are precached by the service worker and can play
      // offline. If the chunk isn't cached, the catch below shows the offline message.
      const mod = await meta.load();
      // Destroy any previous instance first
      if (destroyRef.current) {
        try {
          destroyRef.current();
        } catch {
          // the game is already torn down or never finished mounting: ignore
        }
        destroyRef.current = null;
      }
      const host = createHost(mod.manifest, {
        onGameOver: ({ score, durationMs }) => setFinishedRun({ score, durationMs }),
      });
      const instance = mod.create(host, containerRef.current);
      instanceRef.current = instance;
      destroyRef.current = () => {
        instance.destroy();
        instanceRef.current = null;
      };
      instance.start();
      // Record this game as recently played for feed algorithm
      recordGamePlayed(meta.id);
    } catch (e) {
      console.error(e);
      // Check if it's a network error
      if (!adapters.network.isOnline()) {
        setError("You're offline. Connect to the internet to load this game.");
      } else {
        setError("Failed to load game. Please check your connection and try again.");
      }
    } finally {
      mountingRef.current = false;
      setMounting(false);
    }
  }, [meta]);

  const handleCloseScore = () => {
    setShowScore(false);
    if (destroyRef.current) {
      try {
        destroyRef.current();
      } catch {
        // the game is already torn down or never finished mounting: ignore
      }
      destroyRef.current = null;
    }
    setPlaying(false);
  };

  const handlePlayAgain = () => {
    setShowScore(false);
    setPlaying(true);
    if (instanceRef.current) {
      // Same Phaser game, fresh run: no new WebGL context, no reload.
      instanceRef.current.restart();
      recordGamePlayed(meta?.id ?? "");
      return;
    }
    void mountGame();
  };

  useEffect(() => {
    if (!meta || !finishedRun) return;
    setFinishedRun(null);
    setRunsFinished((n) => n + 1);
    // Keep the game mounted so it's visible in the background
    setLastScore(finishedRun.score);
    setLastDurationMs(finishedRun.durationMs);
    setShowScore(true);
    // Counted for the rating prompt, which only ever asks on the landing page (T7.4).
    recordPlay(meta.id);
  }, [finishedRun, meta]);

  // Hiding the tab pauses an SDK game; the player resumes from the Paused overlay.
  useEffect(() => {
    if (!playing) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && instanceRef.current && !showScore) {
        instanceRef.current.pause();
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [playing, showScore]);

  // The header's sound toggle reaches the running game's Phaser sound too.
  useEffect(() => onMutedChange((m) => instanceRef.current?.setMuted(m)), []);

  const handleResume = () => {
    instanceRef.current?.resume();
    setPaused(false);
  };

  useEffect(() => {
    let canceled = false;
    const doMount = async () => {
      if (!playing || canceled) return;
      await mountGame();
    };
    void doMount();
    return () => {
      canceled = true;
      if (destroyRef.current) {
        try {
          destroyRef.current();
        } catch {
          // the game is already torn down or never finished mounting: ignore
        }
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
    if (!meta) return brand.description;
    return getGameSeoDescription(meta.id, meta.description);
  }, [meta]);

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <Seo
        title={meta ? `${meta.title} | ${brand.name}` : `${brand.name} | ${brand.tagline}`}
        description={seoDescription}
        url={`${SITE_URL}/games/${meta?.id ?? ""}`}
        canonical={`${SITE_URL}/games/${meta?.id ?? ""}`}
        image={shareImageFor(meta?.thumbnail)}
        articlePublishedTime={meta?.createdAt}
        articleModifiedTime={meta?.updatedAt}
        jsonLd={jsonLd}
      />

      <GameHeader
        title={meta?.title ?? "Unknown Game"}
        leaderboardTo={meta ? `/leaderboard/${meta.id}` : undefined}
        showMute={playing}
        onBack={() => {
          if (playing) {
            setShowScore(false);
            setLastScore(null);
            setPlaying(false);
            return;
          }
          void navigate("/");
        }}
      />

      {error && <div className="p-4 text-grape">{error}</div>}
      {meta?.status === "inactive" && (
        <div className="max-w-md mx-auto px-6 pt-24 pb-10 text-center">
          <h1 className="font-display text-3xl font-extrabold text-ink">{meta.title}</h1>
          <p className="kid-note mt-3 text-ink-2">
            This game is taking a break while we make it better. Try another one!
          </p>
          <button type="button" className="btn btn-primary mt-6" onClick={() => void navigate("/")}>
            See all the games
          </button>
        </div>
      )}
      {meta && meta.status !== "inactive" && !error && (
        <div className="landing-panel" data-state={landingState} aria-hidden={playing}>
          <GameLanding
            meta={meta}
            onPlay={() => setPlaying(true)}
            canPromptRating={!playing && runsFinished === 0}
          />
        </div>
      )}

      {playing && (
        <div
          aria-hidden
          className="fixed inset-x-0 bottom-0 z-0 pointer-events-none bg-gradient-to-br from-paper via-paper-2 to-paper"
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
          className="relative w-full h-full overflow-hidden bg-paper"
        />
        {paused && playing && !showScore && (
          <button
            type="button"
            onClick={handleResume}
            className="absolute inset-0 z-[1001] flex flex-col items-center justify-center gap-4 bg-scrim/60"
          >
            <span className="card px-8 py-6 text-center">
              <span className="block font-display text-3xl font-extrabold text-ink">Paused</span>
              <span className="mt-1 block text-sm font-semibold text-ink-2">
                Tap to keep playing
              </span>
            </span>
          </button>
        )}
        {mounting && playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-paper/90 z-[1000]">
            <div className="flex flex-col items-center">
              <img src={brand.logoMark} alt="Loading" className="w-24 h-24 animate-glow-pulse" />
              <div className="mt-4 text-brand font-bold tracking-[0.35em] text-sm">LOADING</div>
            </div>
          </div>
        )}
      </div>

      <GameOver
        open={showScore}
        score={lastScore}
        gameId={meta?.id}
        previousBest={previousBest}
        durationMs={lastDurationMs}
        onClose={handleCloseScore}
        onPlayAgain={handlePlayAgain}
        onViewLeaderboard={meta ? () => navigate(`/leaderboard/${meta.id}`) : undefined}
      />
    </div>
  );
}
