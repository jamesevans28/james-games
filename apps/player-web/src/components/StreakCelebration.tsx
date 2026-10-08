import { useEffect, useState, useCallback, useRef } from "react";
import { checkinStreak, type StreakCheckinResponse } from "../lib/api";
import { useAuth } from "../context/FirebaseAuthProvider";

// SVG Icons for different streak levels
const StreakIcon = ({ streak }: { streak: number }) => {
  if (streak >= 365) {
    // Crown for legendary streaks
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
        <path
          d="M40 15L45 30L60 25L50 40L65 45L40 50L15 45L30 40L20 25L35 30L40 15Z"
          fill="url(#crown-gradient)"
          stroke="#FFD700"
          strokeWidth="2"
        />
        <rect
          x="20"
          y="50"
          width="40"
          height="10"
          rx="2"
          fill="url(#crown-gradient)"
          stroke="#FFD700"
          strokeWidth="2"
        />
        <defs>
          <linearGradient id="crown-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#FFA500" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (streak >= 100) {
    // Trophy
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
        <path
          d="M25 20H55V35C55 43.284 48.284 50 40 50C31.716 50 25 43.284 25 35V20Z"
          fill="url(#trophy-gradient)"
          stroke="#FFD700"
          strokeWidth="2"
        />
        <path d="M20 20H25V30C20 30 15 25 15 20H20Z" fill="#FFD700" />
        <path d="M55 20H60C65 20 65 30 60 30H55V20Z" fill="#FFD700" />
        <rect x="35" y="50" width="10" height="15" fill="#FFD700" />
        <rect x="25" y="65" width="30" height="5" rx="2" fill="url(#trophy-gradient)" />
        <defs>
          <linearGradient id="trophy-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#FFA500" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (streak >= 30) {
    // Flame
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
        <path
          d="M40 10C40 10 50 25 50 35C50 43.284 45.523 50 40 50C34.477 50 30 43.284 30 35C30 25 40 10 40 10Z"
          fill="url(#flame-gradient)"
        />
        <path
          d="M40 25C40 25 45 32 45 37C45 41.418 42.761 45 40 45C37.239 45 35 41.418 35 37C35 32 40 25 40 25Z"
          fill="#FFE44D"
        />
        <defs>
          <linearGradient id="flame-gradient" x1="40" y1="10" x2="40" y2="50">
            <stop offset="0%" stopColor="#FF6B35" />
            <stop offset="50%" stopColor="#FF8E3C" />
            <stop offset="100%" stopColor="#FFBB00" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (streak >= 14) {
    // Star burst
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
        <path
          d="M40 15L43 32L55 25L48 38L65 40L48 42L55 55L43 48L40 65L37 48L25 55L32 42L15 40L32 38L25 25L37 32L40 15Z"
          fill="url(#star-gradient)"
          stroke="#FFD700"
          strokeWidth="2"
        />
        <circle cx="40" cy="40" r="8" fill="#FFF" />
        <defs>
          <linearGradient id="star-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE44D" />
            <stop offset="100%" stopColor="#FFD700" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (streak >= 7) {
    // Target/Bullseye
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
        <circle cx="40" cy="40" r="30" fill="none" stroke="#4ECDC4" strokeWidth="3" />
        <circle cx="40" cy="40" r="20" fill="none" stroke="#45B7AF" strokeWidth="3" />
        <circle cx="40" cy="40" r="10" fill="#4ECDC4" />
        <circle cx="40" cy="40" r="4" fill="#FFF" />
      </svg>
    );
  }
  if (streak >= 5) {
    // Hand with 5 fingers
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
        <g transform="translate(15, 15)">
          <rect x="8" y="25" width="7" height="20" rx="3.5" fill="url(#hand-gradient)" />
          <rect x="17" y="20" width="7" height="25" rx="3.5" fill="url(#hand-gradient)" />
          <rect x="26" y="18" width="7" height="27" rx="3.5" fill="url(#hand-gradient)" />
          <rect x="35" y="22" width="7" height="23" rx="3.5" fill="url(#hand-gradient)" />
          <rect x="44" y="28" width="7" height="17" rx="3.5" fill="url(#hand-gradient)" />
          <rect x="8" y="42" width="43" height="15" rx="7" fill="url(#hand-gradient)" />
        </g>
        <defs>
          <linearGradient id="hand-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE66D" />
            <stop offset="100%" stopColor="#FF6B6B" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (streak >= 3) {
    // Three ascending bars
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
        <rect x="15" y="45" width="12" height="20" rx="2" fill="url(#bars-gradient-1)" />
        <rect x="34" y="35" width="12" height="30" rx="2" fill="url(#bars-gradient-2)" />
        <rect x="53" y="25" width="12" height="40" rx="2" fill="url(#bars-gradient-3)" />
        <defs>
          <linearGradient id="bars-gradient-1" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#667EEA" />
            <stop offset="100%" stopColor="#764BA2" />
          </linearGradient>
          <linearGradient id="bars-gradient-2" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#667EEA" />
            <stop offset="100%" stopColor="#764BA2" />
          </linearGradient>
          <linearGradient id="bars-gradient-3" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#667EEA" />
            <stop offset="100%" stopColor="#764BA2" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  // Default: Double check marks
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
      <path
        d="M20 40L30 50L50 25"
        stroke="url(#check-gradient)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30 40L40 50L60 25"
        stroke="url(#check-gradient)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="check-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#56CCF2" />
          <stop offset="100%" stopColor="#2F80ED" />
        </linearGradient>
      </defs>
    </svg>
  );
};

// Celebration messages based on streak length
const getStreakMessage = (streak: number): { title: string; subtitle: string } => {
  if (streak >= 365) {
    return {
      title: "LEGENDARY!",
      subtitle: `${streak} days! You're absolutely unstoppable!`,
    };
  }
  if (streak >= 100) {
    return {
      title: "INCREDIBLE!",
      subtitle: `${streak} days of pure dedication!`,
    };
  }
  if (streak >= 30) {
    return {
      title: "ON FIRE!",
      subtitle: `${streak} days! You're a true champion!`,
    };
  }
  if (streak >= 14) {
    return {
      title: "AMAZING!",
      subtitle: `${streak} days and counting!`,
    };
  }
  if (streak >= 7) {
    return {
      title: "PERFECT WEEK!",
      subtitle: `${streak} days! Keep the momentum!`,
    };
  }
  if (streak >= 5) {
    return {
      title: "HIGH FIVE!",
      subtitle: `${streak} days in a row!`,
    };
  }
  if (streak >= 3) {
    return {
      title: "HAT TRICK!",
      subtitle: `${streak} days! You're building something great!`,
    };
  }
  return {
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

// Storage key for last celebration shown date (not checkin - checkin happens every visit)
const LAST_CELEBRATION_KEY = "streak:lastCelebration";

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

    // Check if we already showed celebration today (avoid repeat popups on multiple visits)
    const lastCelebration = localStorage.getItem(LAST_CELEBRATION_KEY);
    if (lastCelebration === today) {
      return;
    }

    try {
      const result = await checkinStreak();
      if (result) {
        // Show celebration if streak is 2+ days (every day with an active streak)
        if (result.currentStreak >= 2) {
          localStorage.setItem(LAST_CELEBRATION_KEY, today);
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

  const { title, subtitle } = getStreakMessage(streakData.currentStreak);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isAnimating ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      {/* Backdrop with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-grape/90 via-sky/90 to-tomato/90 backdrop-blur-sm" />

      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
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
            <div
              className="w-2 h-2 rounded-full bg-white/30"
              style={{
                boxShadow: "0 0 10px rgba(255,255,255,0.5)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Celebration card */}
      <div
        className={`relative bg-gradient-to-br from-card via-card to-paper-2 rounded-3xl p-8 max-w-sm w-full shadow-2xl transform transition-all duration-500 ${
          isAnimating ? "scale-100 translate-y-0" : "scale-90 translate-y-8"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-brand/20 via-transparent to-grape/20 blur-xl" />

        {/* Content */}
        <div className="relative text-center">
          {/* Icon with pulse animation */}
          <div className="mb-4 animate-bounce-slow">
            <StreakIcon streak={streakData.currentStreak} />
          </div>

          {/* Streak counter with animated ring */}
          <div className="relative inline-flex items-center justify-center mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-brand to-grape animate-spin-slow opacity-50 blur-md" />
            <div className="relative bg-brand text-on-brand font-black text-4xl w-24 h-24 rounded-full flex items-center justify-center shadow-lg border-4 border-edge">
              {streakData.currentStreak}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand via-sun to-grape mb-2 animate-pulse">
            {title}
          </h2>

          {/* Subtitle */}
          <p className="text-ink-2 font-semibold mb-6">{subtitle}</p>

          {/* Longest streak info */}
          {streakData.longestStreak > streakData.currentStreak && (
            <p className="text-sm text-ink-3 mb-4">
              Your best: {streakData.longestStreak} days
            </p>
          )}
          {streakData.longestStreak === streakData.currentStreak &&
            streakData.currentStreak >= 3 && (
              <p className="text-sm text-brand font-bold mb-4 animate-pulse">
                New personal best!
              </p>
            )}

          {/* Close button */}
          <button
            className="w-full py-3 px-6 bg-gradient-to-r from-brand to-grass text-on-brand font-bold rounded-full shadow-lg hover:shadow-sticker transition-all active:scale-95"
            onClick={handleClose}
          >
            Keep Playing!
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
