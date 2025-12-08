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
      <div className="mx-auto max-w-xl rounded-xl border border-neutral-300 bg-white/95 shadow-lg backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-neutral-800">
            Create a free account to save your high scores, rate games, and play with friends.
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/signup"
              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm whitespace-nowrap"
            >
              Sign up
            </a>
            <a
              href="/login"
              className="px-3 py-1.5 rounded-md bg-neutral-800 text-white text-sm whitespace-nowrap"
            >
              Sign in
            </a>
            <button
              className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-700"
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
