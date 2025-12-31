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
    <header className="w-full border-b border-gray-200 bg-white/95 sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            onClick={() => setDrawerOpen(false)}
            className="text-lg font-extrabold tracking-tight hover:opacity-80 focus:outline-none"
          >
            <img
              src="/assets/shared/logo_square.png"
              alt="Games4James"
              className="w-12 h-12 rounded"
            />
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                markRead();
                navigate("/notifications");
              }}
              className="relative w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:text-black focus:outline-none focus:ring-2 focus:ring-black"
              aria-label="Notifications"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full"
                  aria-hidden
                />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 rounded-full overflow-hidden focus:outline-none flex items-center justify-center"
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
