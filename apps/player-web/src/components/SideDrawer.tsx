import { Link } from "react-router-dom";
import { ProfileAvatar } from "./profile";
import { useSession } from "../hooks/useSession";
import { useAuth } from "../context/FirebaseAuthProvider";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

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
  const buildLabel = import.meta.env.DEV ? "local" : import.meta.env.VITE_BUILD_NUMBER || "unknown";
  const { user } = useSession();
  const profilePath = user?.userId ? `/profile/${user.userId}` : "/profile";
  const linkClass =
    "w-full text-left inline-flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-flingo-800 bg-white border-2 border-flingo-100 hover:border-flingo-300 hover:bg-flingo-50 focus:outline-none focus:ring-2 focus:ring-flingo-400 transition-all";

  const panelRef = useRef<HTMLDivElement>(null);

  // Manage focus: move focus into drawer when opened, restore when closed
  useEffect(() => {
    if (open && panelRef.current) {
      // Save the currently focused element to restore later
      const previouslyFocused = document.activeElement as HTMLElement;

      // Move focus into the drawer
      const firstFocusable = panelRef.current.querySelector("a, button") as HTMLElement;
      firstFocusable?.focus();

      return () => {
        // Restore focus when drawer closes
        previouslyFocused?.focus();
      };
    }
  }, [open]);

  const drawerContent = (
    <div
      className={`fixed inset-0 z-[10000] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <div
        className={`absolute inset-0 bg-flingo-900/40 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={`fixed top-0 bottom-0 right-0 w-80 max-w-[85vw] bg-gradient-to-b from-white via-white to-flingo-50 shadow-2xl border-l-2 border-flingo-200 transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col h-full">
          {/* Logo header */}
          <div className="px-6 py-6 bg-white flex items-center justify-center border-b-2 border-flingo-100">
            <img src="/assets/shared/flingo-logo.svg" alt="Flingo.fun" className="w-24 h-24" />
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <nav className="flex flex-col gap-2">
              <Link
                to="/"
                className={linkClass}
                onClick={onClose}
                role="button"
                aria-pressed="false"
              >
                <svg
                  className="w-5 h-5 text-flingo-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
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
                  <svg
                    className="w-5 h-5 text-flingo-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"
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
                <svg
                  className="w-5 h-5 text-flingo-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Account settings</span>
              </Link>

              <Link
                to="/settings/avatar"
                className={linkClass}
                onClick={onClose}
                role="button"
                aria-pressed="false"
              >
                <svg
                  className="w-5 h-5 text-flingo-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
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

              <Link to="/followers" className={linkClass} onClick={onClose} role="button">
                <svg
                  className="w-5 h-5 text-flingo-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"
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
                  <svg
                    className="w-5 h-5 text-flingo-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M18 15V11a6 6 0 1 0-12 0v4L4.5 18h15z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13.73 21a2 2 0 0 1-3.46 0"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="flex items-center gap-1">
                    Notifications
                    {hasUnreadNotifications && (
                      <span
                        className="inline-flex w-2 h-2 rounded-full bg-candy-pink"
                        aria-hidden
                      />
                    )}
                  </span>
                </Link>
              )}
            </nav>
          </div>

          <div className="p-4 border-t-2 border-flingo-100 bg-white">
            {isAuthenticated ? (
              <Link
                to={profilePath}
                onClick={onClose}
                className="flex items-center gap-3 mb-3 hover:bg-flingo-50 rounded-xl px-2 py-2 transition-colors"
              >
                <ProfileAvatar user={user} size={48} />
                <div className="min-w-0">
                  <div className="text-xs text-flingo-500 leading-tight font-medium">
                    Signed in as
                  </div>
                  <div className="text-sm font-bold text-flingo-900 truncate max-w-[12rem]">
                    {(user as any)?.screenName || "Player"}
                  </div>
                </div>
              </Link>
            ) : user ? (
              <div className="flex items-center gap-3 mb-3 px-2 py-2">
                <ProfileAvatar user={user} size={48} />
                <div className="min-w-0">
                  <div className="text-xs text-flingo-500 leading-tight font-medium">
                    Playing as guest
                  </div>
                  <div className="text-sm font-bold text-flingo-900 truncate max-w-[12rem]">
                    {(user as any)?.screenName || "Guest"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 mb-3 px-2">
                <ProfileAvatar user={{ avatar: 1 }} size={48} />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-flingo-900">Not logged in</div>
                </div>
              </div>
            )}

            {isAuthenticated ? (
              <LogoutButton onClose={onClose} />
            ) : (
              <div className="flex gap-2">
                <Link
                  to="/login"
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-full border-2 border-flingo-200 text-flingo-700 font-semibold hover:bg-flingo-50 transition-colors"
                  onClick={onClose}
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-gradient-to-r from-flingo-500 to-flingo-700 text-white font-semibold hover:from-flingo-600 hover:to-flingo-800 transition-all shadow-fun"
                  onClick={onClose}
                >
                  Sign up
                </Link>
              </div>
            )}

            <div className="mt-4 text-[10px] text-flingo-400 text-center font-medium">
              Build {buildLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(drawerContent, document.body) : null;
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
      className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-full border-2 border-flingo-200 text-flingo-700 font-semibold hover:bg-flingo-50 transition-colors disabled:opacity-50"
    >
      {busy ? "Signing out..." : "Log out"}
    </button>
  );
}
