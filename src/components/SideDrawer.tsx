import { Link } from "react-router-dom";
import { ProfileAvatar } from "./profile";
import { useSession } from "../hooks/useSession";
import { useAuth } from "../context/AuthProvider";
import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  isAuthenticated?: boolean;
  hasUnreadNotifications?: boolean;
  onNotificationsOpen?: () => void;
};

export default function SideDrawer({
  open,
  onClose,
  isAuthenticated,
  hasUnreadNotifications,
  onNotificationsOpen,
}: Props) {
  const { user } = useSession();
  const profilePath = user?.userId ? `/profile/${user.userId}` : "/profile";
  const linkClass =
    "w-full text-left inline-flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium text-gray-800 bg-white border border-gray-200 hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors";
  return (
    <div
      className={`fixed inset-0 z-[10000] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      {/* panel */}
      <div
        className={`absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-xl border-l border-gray-200 transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header: full-width logo */}
        <div className="border-b border-gray-200 h-34 flex items-center justify-center">
          <img
            src="/assets/shared/logo_square.png"
            alt="Games4James"
            className="w-40 h-30 object-cover"
          />
        </div>

        {/* Body */}
        <div className="p-3">
          <nav className="flex flex-col gap-1">
            <Link to="/" className={linkClass} onClick={onClose} role="button" aria-pressed="false">
              <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Games</span>
            </Link>
            {isAuthenticated && user?.userId && (
              <Link
                to={profilePath}
                className={linkClass}
                onClick={onClose}
                role="button"
                aria-pressed="false"
              >
                <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 12a4 4 0 100-8 4 4 0 000 8z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 21v-1c0-2.761 3.134-5 7-5s7 2.239 7 5v1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>My profile</span>
              </Link>
            )}
            <Link
              to="/settings"
              className={linkClass}
              onClick={onClose}
              role="button"
              aria-pressed="false"
            >
              <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 20v-1c0-2.21 3.58-4 8-4s8 1.79 8 4v1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Change screen name</span>
            </Link>
            <Link
              to="/settings/avatar"
              className={linkClass}
              onClick={onClose}
              role="button"
              aria-pressed="false"
            >
              <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="8.5"
                  cy="9"
                  r="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 21l-5-5-3 3-4-4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Choose avatar</span>
            </Link>
            <Link
              to="/followers"
              className={linkClass}
              onClick={onClose}
              role="button"
              aria-pressed="false"
            >
              <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 11a4 4 0 100-8 4 4 0 000 8z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 21v-1c0-2.761 3.134-5 7-5s7 2.239 7 5v1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Followers</span>
            </Link>
            {isAuthenticated && (
              <Link
                to="/notifications"
                className={`${linkClass} relative`}
                onClick={() => {
                  if (onNotificationsOpen) {
                    onNotificationsOpen();
                  } else {
                    onClose();
                  }
                }}
                role="button"
                aria-pressed="false"
              >
                <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M18 15V11a6 6 0 10-12 0v4l-1.5 3h15L18 15z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13.73 21a2 2 0 01-3.46 0"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="flex items-center gap-1">
                  Notifications
                  {hasUnreadNotifications && (
                    <span className="inline-flex w-2 h-2 rounded-full bg-red-500" aria-hidden />
                  )}
                </span>
              </Link>
            )}
          </nav>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          {isAuthenticated ? (
            <Link
              to={profilePath}
              onClick={onClose}
              className="flex items-center gap-3 mb-3 hover:bg-gray-50 rounded-lg px-2 py-1"
            >
              <ProfileAvatar user={user} size={48} />
              <div className="min-w-0">
                <div className="text-xs text-gray-500 leading-tight">Signed in as</div>
                <div className="text-sm font-semibold text-gray-900 truncate max-w-[12rem]">
                  {(user as any)?.screenName || "Player"}
                </div>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3 mb-3">
              <ProfileAvatar user={{ avatar: 1 }} size={48} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">Not logged in</div>
              </div>
            </div>
          )}
          {isAuthenticated ? (
            <LogoutButton onClose={onClose} />
          ) : (
            <div className="flex gap-2">
              <Link
                to="/login"
                className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-100 transition-colors"
                onClick={onClose}
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                onClick={onClose}
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogoutButton({ onClose }: { onClose: () => void }) {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut();
    } catch (e) {
      // ignore errors — still close the drawer and clear UI
    } finally {
      setBusy(false);
      onClose();
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={busy}
      className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-100 transition-colors"
    >
      {busy ? "Signing out..." : "Log out"}
    </button>
  );
}
