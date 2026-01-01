import { useEffect, useState, useCallback, useRef } from "react";
import { checkinStreak, type StreakCheckinResponse } from "../lib/api";
import { useAuth } from "../context/FirebaseAuthProvider";

// Celebration messages based on streak length
const getStreakMessage = (streak: number): { emoji: string; title: string; subtitle: string } => {
  if (streak >= 365) {
    return {
      emoji: "👑",
      title: "LEGENDARY!",
      subtitle: `${streak} days! You're absolutely unstoppable!`,
    };
  }
  if (streak >= 100) {
    return {
      emoji: "🏆",
      title: "INCREDIBLE!",
      subtitle: `${streak} days of pure dedication!`,
    };
  }
  if (streak >= 30) {
    return {
      emoji: "🔥",
      title: "ON FIRE!",
      subtitle: `${streak} days! You're a true champion!`,
    };
  }
  if (streak >= 14) {
    return {
      emoji: "⭐",
      title: "AMAZING!",
      subtitle: `${streak} days and counting!`,
    };
  }
  if (streak >= 7) {
    return {
      emoji: "🎯",
      title: "PERFECT WEEK!",
      subtitle: `${streak} days! Keep the momentum!`,
    };
  }
  if (streak >= 5) {
    return {
      emoji: "✨",
      title: "HIGH FIVE!",
      subtitle: `${streak} days in a row!`,
    };
  }
  if (streak >= 3) {
    return {
      emoji: "🚀",
      title: "HAT TRICK!",
      subtitle: `${streak} days! You're building something great!`,
    };
  }
  return {
    emoji: "🎉",
    title: "STREAK!",
    subtitle: `${streak} days in a row!`,
  };
};

// Get today's date in YYYY-MM-DD format in user's local timezone
function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Storage key for last checkin date to avoid multiple popups per day
const LAST_CHECKIN_KEY = "streak:lastCheckin";

export default function StreakCelebration() {
  const { user, initialized, firebaseUser } = useAuth();
  const [showCelebration, setShowCelebration] = useState(false);
  const [streakData, setStreakData] = useState<StreakCheckinResponse | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const checkedRef = useRef(false);

  const performCheckin = useCallback(async () => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const today = getTodayDate();

    // Check if we already checked in today (avoid repeat popups)
    const lastCheckin = localStorage.getItem(LAST_CHECKIN_KEY);
    if (lastCheckin === today) {
      return;
    }

    try {
      const result = await checkinStreak(today);
      if (result) {
        // Store that we checked in today
        localStorage.setItem(LAST_CHECKIN_KEY, today);

        // Only show celebration if streak is 2+ days AND it was extended today
        if (result.extended && result.currentStreak >= 2) {
          setStreakData(result);
          setShowCelebration(true);
          setIsAnimating(true);
        }
      }
    } catch (err) {
      console.warn("Failed to checkin streak:", err);
    }
  }, []);

  useEffect(() => {
    // Wait for auth to initialize and user to be logged in with a non-anonymous account
    if (!initialized || !firebaseUser || !user) return;
    if (user.isAnonymous) return; // Don't track streaks for anonymous users

    performCheckin();
  }, [initialized, firebaseUser, user, performCheckin]);

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => setShowCelebration(false), 300);
  }, []);

  if (!showCelebration || !streakData) return null;

  const { emoji, title, subtitle } = getStreakMessage(streakData.currentStreak);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isAnimating ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      {/* Backdrop with confetti-like gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 via-indigo-900/90 to-pink-900/90 backdrop-blur-sm" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          >
            <span className="text-2xl opacity-60">
              {["⭐", "✨", "🌟", "💫", "🔥"][Math.floor(Math.random() * 5)]}
            </span>
          </div>
        ))}
      </div>

      {/* Celebration card */}
      <div
        className={`relative bg-gradient-to-br from-surface-card via-surface-card to-flingo-100 rounded-3xl p-8 max-w-sm w-full shadow-2xl transform transition-all duration-500 ${
          isAnimating ? "scale-100 translate-y-0" : "scale-90 translate-y-8"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-neon-lime/20 via-transparent to-neon-pink/20 blur-xl" />

        {/* Content */}
        <div className="relative text-center">
          {/* Big emoji with pulse animation */}
          <div className="text-7xl mb-4 animate-bounce-slow">{emoji}</div>

          {/* Streak counter with animated ring */}
          <div className="relative inline-flex items-center justify-center mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-neon-lime to-neon-pink animate-spin-slow opacity-50 blur-md" />
            <div className="relative bg-surface-dark text-white font-black text-4xl w-24 h-24 rounded-full flex items-center justify-center shadow-lg border-4 border-white/20">
              {streakData.currentStreak}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-lime via-yellow-400 to-neon-pink mb-2 animate-pulse">
            {title}
          </h2>

          {/* Subtitle */}
          <p className="text-flingo-700 font-semibold mb-6">{subtitle}</p>

          {/* Longest streak info */}
          {streakData.longestStreak > streakData.currentStreak && (
            <p className="text-sm text-flingo-500 mb-4">
              Your best: {streakData.longestStreak} days 🏅
            </p>
          )}
          {streakData.longestStreak === streakData.currentStreak &&
            streakData.currentStreak >= 3 && (
              <p className="text-sm text-neon-lime font-bold mb-4 animate-pulse">
                ⚡ New personal best!
              </p>
            )}

          {/* Close button */}
          <button
            className="w-full py-3 px-6 bg-gradient-to-r from-neon-lime to-emerald-400 text-surface-dark font-bold rounded-full shadow-lg hover:shadow-neon-lime transition-all active:scale-95"
            onClick={handleClose}
          >
            Keep Playing! 🎮
          </button>
        </div>
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(10deg);
          }
        }
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
