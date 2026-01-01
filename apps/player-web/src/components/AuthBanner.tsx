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
      <div className="mx-auto max-w-xl rounded-2xl border border-flingo-200/30 bg-surface-card/95 shadow-card-hover backdrop-blur px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-flingo-800 font-medium">
            Create a free account to save your high scores, rate games, and play with friends.
          </div>
          <div className="flex items-center gap-2">
            <a href="/signup" className="btn btn-primary text-sm whitespace-nowrap">
              Sign up
            </a>
            <a href="/login" className="btn btn-outline text-sm whitespace-nowrap">
              Sign in
            </a>
            <button
              className="p-2 rounded-full text-flingo-500 hover:text-flingo-800 hover:bg-flingo-100 transition-colors"
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
