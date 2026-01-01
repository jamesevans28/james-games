import { useEffect, useRef, useState } from "react";
import { postHighScore, postExperienceRun, type ExperienceSummary } from "../../lib/api";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

type Props = {
  open: boolean;
  score: number | null;
  gameId?: string | null;
  xpMultiplier?: number;
  onClose: () => void;
  onPlayAgain?: () => void;
  onViewLeaderboard?: () => void;
};

function LevelUpModal({ level, onClose }: { level: number; onClose: () => void }) {
  useEffect(() => {
    // Trigger confetti animation
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const colors = ["#FFC700", "#FF0080", "#00D9FF", "#7928CA"];

    const frame = () => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return;

      const particleCount = 3;
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement("div");
        particle.className = "firework-particle";
        particle.style.left = Math.random() * 100 + "%";
        particle.style.top = Math.random() * 100 + "%";
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.animation = `firework ${0.5 + Math.random() * 0.5}s ease-out`;
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 1000);
      }

      requestAnimationFrame(frame);
    };

    frame();
  }, []);

  return (
    <>
      <style>{`
        @keyframes firework {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(${Math.random() * 200 - 100}px, ${
        Math.random() * 200 - 100
      }px) scale(0);
            opacity: 0;
          }
        }
        .firework-particle {
          position: fixed;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 10001;
        }
        @keyframes trophy-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.1); }
        }
        @keyframes glow-pulse-gold {
          0%, 100% { box-shadow: 0 0 20px rgba(200, 255, 50, 0.3), 0 0 40px rgba(255, 235, 59, 0.2); }
          50% { box-shadow: 0 0 40px rgba(200, 255, 50, 0.5), 0 0 60px rgba(255, 235, 59, 0.4); }
        }
      `}</style>
      <div className="fixed inset-0 z-[10001] flex items-center justify-center">
        <div className="absolute inset-0 bg-surface-dark/90 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative bg-gradient-to-b from-neon-yellow/20 to-neon-lime/10 rounded-3xl p-8 max-w-sm mx-4 shadow-neon-lime border-2 border-neon-yellow/50 text-center bg-surface-card"
          style={{ animation: "glow-pulse-gold 2s ease-in-out infinite" }}
        >
          <div
            className="text-8xl mb-4"
            style={{ animation: "trophy-bounce 1s ease-in-out infinite" }}
          >
            🏆
          </div>
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-neon-yellow to-neon-lime mb-2">
            LEVEL UP!
          </h2>
          <p className="text-5xl font-extrabold text-flingo-900 mb-4">Level {level}</p>
          <p className="text-flingo-700 mb-6">Congratulations! You've reached a new level!</p>
          <button type="button" className="btn btn-primary px-8 py-3 text-lg" onClick={onClose}>
            Continue
          </button>
        </div>
      </div>
    </>
  );
}

function AnimatedExperienceBar({
  startLevel,
  startProgress,
  endLevel,
  endProgress,
  startRequired,
  endRequired,
  awardedXp,
}: {
  startLevel: number;
  startProgress: number;
  endLevel: number;
  endProgress: number;
  startRequired: number;
  endRequired: number;
  awardedXp: number;
}) {
  const [displayLevel, setDisplayLevel] = useState(startLevel);
  const [displayProgress, setDisplayProgress] = useState(startProgress);
  const [displayPercent, setDisplayPercent] = useState(0);
  const [displayRequired, setDisplayRequired] = useState(startRequired);
  const [isAnimating, setIsAnimating] = useState(false);

  // Keep the bar accurate even when no XP was awarded (or before the award response arrives).
  useEffect(() => {
    setDisplayLevel(startLevel);
    setDisplayProgress(startProgress);
    setDisplayRequired(startRequired);
    const safe = Math.max(1, startRequired || 1);
    setDisplayPercent(Math.min(100, (startProgress / safe) * 100));
  }, [startLevel, startProgress, startRequired]);

  useEffect(() => {
    if (awardedXp <= 0) return;

    setIsAnimating(true);
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (startLevel === endLevel) {
        // Same level, just animate progress
        const currentProgress = startProgress + (endProgress - startProgress) * progress;
        setDisplayProgress(currentProgress);
        setDisplayRequired(endRequired);
        const safeRequired = Math.max(1, endRequired || 1);
        setDisplayPercent(Math.min(100, (currentProgress / safeRequired) * 100));
      } else {
        // Level up animation
        if (progress < 0.5) {
          // First half: fill to 100%
          const fillProgress = progress * 2;
          setDisplayRequired(startRequired);
          const safeRequired = Math.max(1, startRequired || 1);
          const currentProgress = startProgress + (safeRequired - startProgress) * fillProgress;
          setDisplayProgress(currentProgress);
          setDisplayPercent(Math.min(100, (currentProgress / safeRequired) * 100));
        } else {
          // Second half: new level, fill from 0 to end
          setDisplayLevel(endLevel);
          setDisplayRequired(endRequired);
          const fillProgress = (progress - 0.5) * 2;
          const currentProgress = endProgress * fillProgress;
          setDisplayProgress(currentProgress);
          const safeRequired = Math.max(1, endRequired || 1);
          setDisplayPercent(Math.min(100, (currentProgress / safeRequired) * 100));
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayLevel(endLevel);
        setDisplayProgress(endProgress);
        setDisplayRequired(endRequired);
        const safeRequired = Math.max(1, endRequired || 1);
        setDisplayPercent(Math.min(100, (endProgress / safeRequired) * 100));
        setIsAnimating(false);
      }
    };

    animate();
  }, [startLevel, startProgress, endLevel, endProgress, startRequired, endRequired, awardedXp]);

  const safeRequired = Math.max(1, displayRequired || 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-flingo-600 font-semibold">
        <span>Level {displayLevel}</span>
        <span>
          {Math.round(displayProgress)}/{safeRequired} XP
        </span>
      </div>
      <div className="relative h-4 rounded-full bg-flingo-100 overflow-hidden border border-flingo-200/50">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${displayPercent}%`,
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 8px, transparent 8px, transparent 16px)",
            background: "linear-gradient(90deg, #c8ff32 0%, #32d4ff 50%, #ff3eb5 100%)",
            boxShadow: isAnimating
              ? "0 0 18px rgba(200, 255, 50, 0.6)"
              : "0 0 12px rgba(200, 255, 50, 0.3)",
            transition: "none",
          }}
        />
        <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-white via-transparent to-white pointer-events-none" />
      </div>
      {awardedXp > 0 && <div className="text-xs text-neon-lime font-bold">+{awardedXp} XP</div>}
    </div>
  );
}

export default function GameOver({
  open,
  score,
  gameId,
  xpMultiplier,
  onClose,
  onPlayAgain,
  onViewLeaderboard,
}: Props) {
  const postedRef = useRef<string | null>(null);
  const xpPostedRef = useRef<string | null>(null);
  const { user, refreshProfile } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [startExperience, setStartExperience] = useState<ExperienceSummary | null>(null);
  const [endExperience, setEndExperience] = useState<ExperienceSummary | null>(null);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);
  const [xpPending, setXpPending] = useState(false);
  const [xpError, setXpError] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);

  useEffect(() => {
    if (!open) {
      console.log("GameOver: not posting score because dialog is not open");
      setScoreError(null);
      return;
    }
    const s = Number(score || 0);
    const sig = `${gameId ?? ""}:${s}`;
    if (postedRef.current === sig) {
      console.log("GameOver: score already posted for this run", { sig });
      return;
    }
    if (Number.isNaN(s) || s <= 0) {
      console.log("GameOver: not posting score because score is zero/invalid", { score });
      return;
    }
    if (!gameId) {
      console.log("GameOver: not posting score because gameId is missing", { gameId });
      return;
    }
    if (!user) {
      console.log("GameOver: not posting score because user is not authenticated");
      return;
    }

    // Check if offline
    if (!navigator.onLine) {
      console.log("GameOver: not posting score because device is offline");
      setScoreError("You're offline. Score will not be saved.");
      return;
    }

    postedRef.current = sig;
    setScoreError(null);
    void postHighScore({ gameId, score: s })
      .then((res) => {
        console.log("GameOver: posted score", { gameId, score: s });
        return res;
      })
      .catch((e) => {
        postedRef.current = null;
        console.warn("Failed to post high score", e);
        // Check if the error was due to going offline
        if (!navigator.onLine) {
          setScoreError("You're offline. Score could not be saved.");
        } else {
          setScoreError("Could not save score. Please try again.");
        }
      });
  }, [open, score, gameId, user, isOnline]);

  useEffect(() => {
    if (!open) {
      xpPostedRef.current = null;
      setXpAwarded(null);
      setXpPending(false);
      setXpError(null);
      setStartExperience(user?.experience ?? null);
      setEndExperience(user?.experience ?? null);
      setShowLevelUp(false);
      return;
    }
    if (!startExperience && user?.experience) {
      setStartExperience(user.experience);
      setEndExperience(user.experience);
    }
  }, [open, user?.experience, startExperience]);

  useEffect(() => {
    if (!open || !user || !gameId || !score || score <= 0) return;
    const sig = `${gameId}:${score}`;
    if (xpPostedRef.current === sig) return;

    // Check if offline before attempting XP post
    if (!navigator.onLine) {
      setXpError("You're offline. XP will not be awarded.");
      return;
    }

    xpPostedRef.current = sig;
    setXpPending(true);
    setXpError(null);
    setXpAwarded(null);

    const currentExperience = user.experience;
    if (currentExperience) {
      setStartExperience(currentExperience);
    }

    let canceled = false;
    postExperienceRun({ gameId, score, xpMultiplier })
      .then(({ summary, awardedXp }) => {
        if (canceled) return;
        // Backend may return { summary: null } in edge cases; don't crash the dialog.
        setEndExperience(summary ?? currentExperience ?? null);
        setXpAwarded(awardedXp);
        setXpPending(false);

        // Check for level up
        if (
          currentExperience &&
          summary &&
          typeof summary.level === "number" &&
          summary.level > currentExperience.level
        ) {
          setTimeout(() => {
            setShowLevelUp(true);
          }, 1500); // Show after XP animation completes
        }

        void refreshProfile();
      })
      .catch((err: any) => {
        if (canceled) return;
        if (err?.message === "signin_required") {
          setXpError("Sign in to earn experience.");
        } else if (!navigator.onLine) {
          setXpError("You're offline. XP could not be awarded.");
        } else {
          setXpError(err?.message || "Could not add experience right now.");
        }
        setXpPending(false);
        xpPostedRef.current = null;
      });
    return () => {
      canceled = true;
    };
  }, [open, user?.userId, gameId, score, xpMultiplier, refreshProfile, user?.experience, isOnline]);

  if (!open) return null;

  const phrases = [
    "Great job!",
    "Awesome!",
    "Fantastic!",
    "Well done!",
    "Impressive!",
    "Outstanding!",
    "Superb!",
    "Excellent!",
    "Brilliant!",
    "Amazing!",
    "Incredible!",
    "Spectacular!",
    "Marvelous!",
    "Terrific!",
    "Splendid!",
    "Wonderful!",
    "Fabulous!",
    "Stunning!",
    "Phenomenal!",
    "Epic!",
  ];
  const phrase = phrases[(score ?? 0) % phrases.length];

  return (
    <>
      <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-surface-dark/80 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full sm:w-auto sm:min-w-[320px] max-w-md mx-3 mb-6 sm:mb-0 rounded-3xl overflow-hidden border border-flingo-200/30 bg-surface-card shadow-card-hover">
          <div className="px-5 py-4 border-b border-flingo-200/30">
            <div className="text-lg font-extrabold text-neon-lime text-glow-lime">{phrase}</div>
            <div className="text-flingo-600 text-sm font-medium">Your score</div>
          </div>
          <div className="px-5 py-6">
            <div className="text-5xl font-extrabold text-center text-flingo-900">{score ?? 0}</div>
            {scoreError && (
              <p className="text-xs text-neon-orange mt-2 text-center flex items-center justify-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656m-7.072 9.192a9 9 0 010-12.728m3.536 3.536a4 4 0 010 5.656"
                  />
                </svg>
                {scoreError}
              </p>
            )}
          </div>
          {user ? (
            <div className="px-5 pb-5 border-t border-flingo-200/30">
              <div className="flex items-center justify-between mb-2 pt-4">
                <div className="text-sm font-bold text-flingo-900 flex items-center gap-1">
                  <span role="img" aria-hidden>
                    ✨
                  </span>
                  Level progress
                </div>
                <div className="text-xs text-flingo-600">{xpPending ? "Adding XP…" : ""}</div>
              </div>
              {startExperience && endExperience ? (
                <AnimatedExperienceBar
                  startLevel={startExperience.level}
                  startProgress={startExperience.progress}
                  endLevel={endExperience.level}
                  endProgress={endExperience.progress}
                  startRequired={startExperience.required}
                  endRequired={endExperience.required}
                  awardedXp={xpAwarded ?? 0}
                />
              ) : (
                <p className="text-xs text-flingo-600">
                  Play more runs to unlock experience tracking.
                </p>
              )}
              {xpError && <p className="text-xs text-neon-pink mt-2">{xpError}</p>}
            </div>
          ) : (
            <div className="px-5 pb-4 border-t border-flingo-200/30 text-xs text-flingo-600 pt-4">
              Sign in to earn experience, level up, and unlock a shiny progress bar!
            </div>
          )}
          <div className="px-5 pt-3 pb-5 flex flex-col sm:flex-row gap-3">
            {onPlayAgain && (
              <button type="button" className="btn btn-primary sm:flex-1" onClick={onPlayAgain}>
                Play Again
              </button>
            )}
            {onViewLeaderboard && (
              <button
                type="button"
                className="btn btn-outline sm:flex-1"
                onClick={onViewLeaderboard}
              >
                View Leaderboard
              </button>
            )}
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
      {showLevelUp && endExperience && (
        <LevelUpModal level={endExperience.level} onClose={() => setShowLevelUp(false)} />
      )}
    </>
  );
}
