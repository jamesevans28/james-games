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
    <header className="w-full bg-white/80 backdrop-blur-lg sticky top-0 z-40 border-b-2 border-flingo-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2 hover:opacity-90 focus:outline-none transition-opacity"
          >
            <img
              src="/assets/shared/flingo-logo-small.svg"
              alt="Flingo.fun"
              className="w-10 h-10"
            />
            <span className="text-lg sm:text-xl font-bold flex items-baseline">
              <span className="bg-gradient-to-r from-flingo-500 via-flingo-700 to-flingo-800 bg-clip-text text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent]">
                flingo
              </span>
              <span className="text-candy-pink">.fun</span>
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
              className="relative w-10 h-10 rounded-full bg-flingo-50 flex items-center justify-center text-flingo-600 hover:bg-flingo-100 hover:text-flingo-700 focus:outline-none focus:ring-2 focus:ring-flingo-400 transition-colors"
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
                  className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-candy-pink rounded-full border-2 border-white"
                  aria-hidden
                />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-flingo-400 flex items-center justify-center bg-flingo-50 hover:bg-flingo-100 transition-colors"
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
                className="text-flingo-600"
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
