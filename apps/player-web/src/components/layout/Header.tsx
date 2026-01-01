import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../../hooks/useSession";
import SideDrawer from "../SideDrawer";
import { ProfileAvatar } from "../profile";
import { useNotificationsIndicator } from "../../hooks/useNotificationsIndicator";

export default function Header() {
  const { user } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  // Anonymous users should still see login/signup options
  const isAuthenticated = !!user && !user.isAnonymous;
  const { hasUnread, markRead } = useNotificationsIndicator();

  return (
    <header className="w-full bg-surface-dark/95 backdrop-blur-xl sticky top-0 z-40 border-b border-flingo-200/50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2.5 hover:opacity-90 focus:outline-none transition-opacity group"
          >
            <img
              src="/assets/shared/flingo-logo-small.svg"
              alt="Flingo.fun"
              className="w-10 h-10 group-hover:animate-wiggle"
            />
            <span className="text-lg sm:text-xl font-extrabold flex items-baseline tracking-tight">
              <span className="text-neon-lime text-glow-lime">flingo</span>
              <span className="text-neon-pink">.fun</span>
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                markRead();
                navigate("/notifications");
              }}
              className="relative w-10 h-10 rounded-full bg-flingo-100 flex items-center justify-center text-flingo-700 hover:bg-flingo-200 hover:text-neon-lime focus:outline-none focus:ring-2 focus:ring-neon-lime/50 transition-colors"
              aria-label="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 15V11a6 6 0 10-12 0v4l-1.5 3h15L18 15z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.73 21a2 2 0 01-3.46 0"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {hasUnread && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-neon-pink rounded-full border-2 border-surface-dark animate-pulse"
                  aria-hidden
                />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-neon-lime/50 flex items-center justify-center bg-flingo-100 hover:bg-flingo-200 transition-colors"
            aria-label="Account"
          >
            {isAuthenticated ? (
              <ProfileAvatar user={user} size={40} borderWidth={0} strokeWidth={0} rounded={true} />
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-flingo-700"
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isAuthenticated={isAuthenticated}
        hasUnreadNotifications={hasUnread}
        onNotificationsOpen={() => {
          markRead();
          setDrawerOpen(false);
        }}
      />
    </header>
  );
}
