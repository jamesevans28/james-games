import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/FirebaseAuthProvider";

const REMINDER_KEY = "account:upgradeDismissedAt";
const REMINDER_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days between reminders
const INITIAL_DELAY_MS = 60 * 1000; // Wait 60 seconds before first showing

/**
 * AccountUpgradeBanner: Encourages anonymous users to create an account.
 *
 * - Only shows to anonymous users
 * - Can be dismissed, won't show again for 3 days
 * - Has an initial delay so it doesn't interrupt immediately
 */
export default function AccountUpgradeBanner() {
  const { user, loading, initialized } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Don't show while loading or if not initialized
    if (!initialized || loading) {
      setDismissed(true);
      return;
    }

    // Don't show if no user or if user has a real account
    if (!user || !user.isAnonymous) {
      setDismissed(true);
      return;
    }

    // Check if user has dismissed recently
    const lastDismissed = localStorage.getItem(REMINDER_KEY);
    if (lastDismissed) {
      const timestamp = parseInt(lastDismissed, 10);
      if (Date.now() - timestamp < REMINDER_INTERVAL_MS) {
        setDismissed(true);
        return;
      }
    }

    // Show after initial delay to not be intrusive
    setDismissed(false);
    const timer = setTimeout(() => {
      setVisible(true);
    }, INITIAL_DELAY_MS);

    return () => clearTimeout(timer);
  }, [user, loading, initialized]);

  function handleDismiss() {
    localStorage.setItem(REMINDER_KEY, String(Date.now()));
    setVisible(false);
    setDismissed(true);
  }

  function handleCreateAccount() {
    localStorage.setItem(REMINDER_KEY, String(Date.now()));
    navigate("/login");
  }

  if (dismissed || !visible) return null;

  return (
    <div className="fixed bottom-4 inset-x-0 z-[10000] px-4">
      <div className="mx-auto max-w-xl rounded-2xl border border-sun/30 bg-card/95 shadow-card-hover backdrop-blur px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🎮</div>
          <div className="flex-1">
            <div className="font-bold text-ink text-sm">Save your progress!</div>
            <div className="text-sm text-ink-2 mt-1">
              Create a username to save your high scores and compete on leaderboards. It only takes
              a moment!
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <button
              onClick={handleCreateAccount}
              className="px-4 py-2 rounded-full bg-sun text-on-accent border-2 border-edge text-sm font-bold whitespace-nowrap shadow-sticker hover:shadow-sticker transition-all"
            >
              Create account
            </button>
            <button
              onClick={handleDismiss}
              className="text-xs text-ink-2 hover:text-ink font-medium"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
