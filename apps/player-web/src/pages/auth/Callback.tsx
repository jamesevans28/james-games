import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthProvider";
import { linkProvider } from "../../lib/api";
import { finishSocialRedirect, takePendingRedirect } from "../../lib/supabase";
import { errorCode, errorMessage } from "../../utils/errorCode";

/** Where to go after the redirect: back to the page that started it (the login page's `state`). */
function destination(returnTo: string | undefined): string {
  if (!returnTo) return "/";
  const url = new URL(returnTo, window.location.origin);
  if (url.pathname === "/login" || url.pathname === "/signup") {
    return url.searchParams.get("state") || "/";
  }
  return url.pathname + url.search;
}

/**
 * /auth/callback: Google or Apple send the player back here (Phase 14). Exchanges the
 * code for the session, tells the API the account is linked, loads the profile and
 * returns to the page the player started from. Only reachable while
 * features.socialSignIn is on.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const pending = takePendingRedirect();
    void (async () => {
      try {
        await finishSocialRedirect(window.location.search);
        await linkProvider();
        await refreshProfile();
        void navigate(destination(pending?.returnTo), { replace: true });
      } catch (err) {
        console.error("AuthCallback: sign-in did not finish", errorCode(err));
        setError(errorMessage(err, "Sign-in didn't finish. Try again?"));
      }
    })();
  }, [navigate, refreshProfile]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-6">
      <div className="text-center max-w-sm">
        {error ? (
          <>
            <p className="text-ink font-bold mb-4" role="alert">
              {error}
            </p>
            <Link to="/login" replace className="btn btn-primary">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
            <p className="text-ink font-medium">Signing you in...</p>
          </>
        )}
      </div>
    </div>
  );
}
