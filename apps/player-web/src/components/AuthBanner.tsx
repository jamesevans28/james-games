import { useEffect, useState } from "react";
import { useSession } from "../hooks/useSession";

export default function AuthBanner() {
  const { user, loading } = useSession();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem("authBannerDismissed") === "1");
  }, []);

  if (loading || user || dismissed) return null;

  return (
    <div className="fixed bottom-4 inset-x-0 z-[10000] px-4">
      <div className="mx-auto max-w-xl rounded-2xl border-2 border-flingo-200 bg-white/95 shadow-fun backdrop-blur px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-flingo-700 font-medium">
            Create a free account to save your high scores, rate games, and play with friends.
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/signup"
              className="px-4 py-2 rounded-full bg-gradient-to-r from-candy-mint to-emerald-500 text-white text-sm font-bold whitespace-nowrap shadow-fun"
            >
              Sign up
            </a>
            <a
              href="/login"
              className="px-4 py-2 rounded-full bg-gradient-to-r from-flingo-500 to-flingo-600 text-white text-sm font-bold whitespace-nowrap shadow-fun"
            >
              Sign in
            </a>
            <button
              className="p-2 rounded-full text-flingo-400 hover:text-flingo-600 hover:bg-flingo-50 transition-colors"
              onClick={() => {
                sessionStorage.setItem("authBannerDismissed", "1");
                setDismissed(true);
              }}
              title="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
