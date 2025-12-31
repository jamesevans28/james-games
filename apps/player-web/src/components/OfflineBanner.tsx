import { useOnlineStatus } from "../hooks/useOnlineStatus";

type Props = {
  message?: string;
  className?: string;
};

/**
 * A banner that shows when the user is offline.
 * Can be placed at the top of pages or components that require internet.
 */
export function OfflineBanner({
  message = "You're offline. Connect to the internet to continue.",
  className = "",
}: Props) {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className={`bg-candy-yellow/20 border-2 border-candy-yellow/50 text-amber-800 px-4 py-3 rounded-2xl flex items-center gap-3 ${className}`}
      role="alert"
    >
      <svg
        className="w-5 h-5 flex-shrink-0 text-candy-yellow"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18.364 5.636a9 9 0 010 12.728m0 0l-12.728-12.728m12.728 12.728L5.636 5.636"
        />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

/**
 * A full-page offline message for pages that can't function without internet.
 */
export function OfflineFullPage({
  title = "You're offline",
  message = "This page requires an internet connection. Please check your connection and try again.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const { isOnline } = useOnlineStatus();

  // Auto-retry when back online
  if (isOnline && onRetry) {
    onRetry();
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-flingo-50 via-white to-candy-pink/10 p-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-candy-yellow/30 to-candy-yellow/10 rounded-full flex items-center justify-center border-2 border-candy-yellow/30">
          <svg
            className="w-10 h-10 text-candy-yellow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
            />
            <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-flingo-800 mb-2">{title}</h1>
        <p className="text-flingo-600 mb-6">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-gradient-to-r from-flingo-500 to-flingo-600 text-white rounded-full font-semibold shadow-fun hover:shadow-fun-lg transition-all"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
