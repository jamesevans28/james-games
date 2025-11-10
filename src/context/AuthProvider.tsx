import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
// Auth is handled by the backend local endpoints for username/password.
// Frontend will call POST /auth/local-signin and POST /auth/local-signup and
// rely on cookie-based sessions returned by the server (/me endpoint).

// Client-side auth using Cognito (Amplify SRP) so the app can show native
// login/signup forms without redirecting to Hosted UI. Backend `/me` still
// works for cookie-based sessions and server-side checks.

type AuthUser = {
  userId: string;
  screenName?: string | null;
  email?: string | null;
  emailProvided?: boolean;
  validated?: boolean; // email verified flag from profile
  avatar?: number | null; // numeric avatar index (1..25)
};

type AuthContextType = {
  /** Current authenticated user or null when not signed in */
  user: AuthUser | null;
  /** Loading indicator for in-flight auth operations */
  loading: boolean;
  /**
   * Create an account using the backend's local signup endpoint.
   * The backend is expected to set HttpOnly session cookies on success.
   * After a successful signup this will refresh the local `user` state by
   * calling the backend `/me` endpoint.
   *
   * Throws an Error with a friendly message when signup fails.
   */
  signUp: (args: {
    username: string;
    password: string;
    email?: string;
    screenName?: string;
  }) => Promise<void>;
  /**
   * Sign in using the backend's local signin endpoint. Backend should set
   * HttpOnly session cookies. On success this will refresh local `user` by
   * calling `/me`.
   *
   * Throws an Error when sign in fails.
   */
  signIn: (args: { username: string; password: string }) => Promise<void>;
  /**
   * Sign out the current session. This calls the backend logout endpoint
   * (which clears cookies) and clears local user state. Always safe to call
   * even when not signed in.
   */
  signOut: () => Promise<void>;
  /**
   * Fetch the current authenticated user from the backend `/me` endpoint.
   * IMPORTANT: This will call a protected endpoint and therefore must only
   * be invoked when the app knows a session exists (for example immediately
   * after signIn or signUp). It does NOT run automatically on mount to
   * avoid making protected calls when the user is not logged in.
   */
  refreshSession: (opts?: { silent?: boolean }) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

  // NOTE: We intentionally do NOT call `/me` on mount. The app should only
  // call protected backend endpoints when it knows a session exists. This
  // avoids unnecessary protected calls that would return 401 when the user
  // is not authenticated.

  /**
   * Internal helper to fetch `/me` and populate local `user` state.
   * Call this only when you know the user has just authenticated (signIn/signUp)
   * or when the app has some other reason to believe a session exists.
   */
  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/me`, { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const body = await res.json();
      if (body?.user) {
        setUser({
          userId: body.user.userId,
          screenName: body.user.screenName ?? null,
          email: body.user.email ?? null,
          emailProvided: body.user.emailProvided ?? false,
          validated: body.user.validated ?? false,
          avatar:
            typeof body.user.avatar === "number"
              ? body.user.avatar
              : Number(body.user.avatar) || null,
        });
        return;
      }
    } catch (err) {
      // network or parse error: clear user
    }
    setUser(null);
  }, [apiBase]);

  // Attempt to restore an existing session once on mount. This will call the
  // protected `/me` endpoint and expects the backend to accept HttpOnly
  // cookies and refresh the session/refresh token as needed. We do this once
  // so returning users stay signed in without needing to manually sign in.
  //
  // Assumptions:
  // - The backend stores refresh tokens or session state in HttpOnly cookies.
  // - Calling `/me` will either return the user (200) and extend the session,
  //   or return 401/204 when no valid session exists.
  // If your backend exposes a dedicated lightweight `/auth/session` or
  // `/auth/refresh` endpoint you may prefer to call that instead.
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        await fetchMe();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = useCallback(
    async ({
      username,
      password,
      email,
      screenName,
    }: {
      username: string;
      password: string;
      email?: string;
      screenName?: string;
    }) => {
      const res = await fetch(`${apiBase}/auth/local-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Ensure cookies set by the server (HttpOnly session cookies) are accepted by the browser
        credentials: "include",
        body: JSON.stringify({ username, password, email, screenName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Sign up failed");
      }
      // Server signs the user in and sets HttpOnly cookies. Refresh local user state.
      setLoading(true);
      try {
        await fetchMe();
      } finally {
        setLoading(false);
      }
    },
    [apiBase, fetchMe]
  );

  const signIn = useCallback(
    async ({ username, password }: { username: string; password: string }) => {
      const res = await fetch(`${apiBase}/auth/local-signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Sign in failed");
      }
      setLoading(true);
      try {
        await fetchMe();
      } finally {
        setLoading(false);
      }
    },
    [apiBase, fetchMe]
  );

  /**
   * Sign out: call backend logout endpoint to clear cookies and clear local state.
   * Safe to call when not signed in.
   */
  const signOut = useCallback(async () => {
    try {
      await fetch(`${apiBase}/auth/logout`, { credentials: "include" });
    } catch {
      // ignore network errors — we still clear client state
    }
    setUser(null);
  }, [apiBase]);

  // Hosted UI is not used in this project. Keep the API surface small and
  // rely on custom front-end forms that call `/auth/local-signin` and `/auth/local-signup`.

  /**
   * Refresh the local session by calling `/me`. This is a protected call and
   * should only be invoked when the app knows a session likely exists (for
   * example, after the backend set cookies on sign in).
   */
  const refreshSession = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;
      if (!silent) setLoading(true);
      try {
        await fetchMe();
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [fetchMe]
  );

  // --- Automatic periodic refresh -------------------------------------------------
  // Goal: keep the user logged in indefinitely even while idle by proactively
  // invoking a protected endpoint (`/me`) which triggers server-side token
  // refresh (attachUser middleware). Because tokens are stored in HttpOnly
  // cookies we cannot read expiry client-side; we assume a 60m access token
  // lifespan and refresh every 50m. Multi‑tab coordination prevents refresh
  // storms: whichever tab performs the refresh broadcasts to others.
  // We also refresh shortly after regaining focus if the scheduled time has
  // passed.
  // Tokens updated: access/id tokens are 1 day, refresh token is 365 days.
  // Schedule a proactive refresh before the 1-day access token expires.
  // Use 23 hours so we refresh ~1 hour before expiry.
  const REFRESH_INTERVAL_MS = 23 * 60 * 60 * 1000; // 23 hours
  const MIN_SPACING_MS = 5 * 60 * 1000; // 5 minutes debounce between tabs
  const STORAGE_KEY = "auth:lastRefresh"; // localStorage timestamp key
  const bcRef = React.useRef<BroadcastChannel | null>(null);
  const intervalRef = React.useRef<number | null>(null);

  const performScheduledRefresh = useCallback(async () => {
    // If not signed in skip.
    if (!user) return;
    const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
    const now = Date.now();
    if (now - last < MIN_SPACING_MS) return; // another tab refreshed recently
    try {
      // Call proactive refresh endpoint; if it succeeds update timestamp & broadcast.
      const res = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        bcRef.current?.postMessage({ type: "refreshed", at: Date.now() });
        // Optionally refresh user profile silently to reflect any changes.
        await refreshSession({ silent: true });
      } else if (res.status === 401) {
        // Refresh failed (maybe refresh token expired) — clear user locally.
        setUser(null);
      }
    } catch {
      // Ignore network failures (offline); will retry later.
    }
  }, [user, apiBase, refreshSession]);

  // Listen for broadcasts from other tabs so each tab stays in sync.
  useEffect(() => {
    bcRef.current = new BroadcastChannel("auth-refresh");
    const bc = bcRef.current;
    bc.onmessage = (ev) => {
      if (ev?.data?.type === "refreshed") {
        // Update local timestamp; no need to call /me again.
        localStorage.setItem(STORAGE_KEY, String(ev.data.at || Date.now()));
      }
    };
    return () => {
      bc.close();
    };
  }, []);

  // Set up periodic timer.
  useEffect(() => {
    // Clear any existing interval first.
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    // Start interval only if user is signed in.
    if (user) {
      intervalRef.current = window.setInterval(() => {
        void performScheduledRefresh();
      }, REFRESH_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [user, performScheduledRefresh]);

  // On visibilitychange / focus, if we've crossed the interval boundary and
  // haven't refreshed recently, trigger a refresh to avoid expiry after long
  // idle periods or sleeping the laptop. Use a larger catch-up margin for day-long
  // tokens: refresh if we're within ~10 minutes of the scheduled refresh time.
  useEffect(() => {
    function onVisibilityOrFocus() {
      if (!user) return;
      const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
      const now = Date.now();
      if (now - last > REFRESH_INTERVAL_MS - 10 * 60 * 1000) {
        void performScheduledRefresh();
      }
    }
    window.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);
    return () => {
      window.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [user, performScheduledRefresh]);
  // -------------------------------------------------------------------------------

  const value = useMemo<AuthContextType>(
    () => ({ user, loading, signUp, signIn, signOut, refreshSession }),
    [user, loading, signUp, signIn, signOut, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
