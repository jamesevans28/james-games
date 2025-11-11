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
  const [loading, setLoading] = useState(true); // Start with loading = true to prevent premature redirects
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

  // Detect if running in PWA context
  const isPWA = React.useMemo(() => {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://")
    );
  }, []);

  // Detect if running on mobile
  const isMobile = React.useMemo(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }, []);

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
      const res = await fetch(`${apiBase}/me`, {
        credentials: "include",
        cache: "no-store", // Bypass all caches for auth endpoints
      });
      if (!res.ok) {
        setUser(null);
        // Clear localStorage backup on auth failure
        if (isMobile || isPWA) {
          localStorage.removeItem("auth:session");
        }
        return;
      }
      const body = await res.json();

      // Handle both response formats: { user: {...} } or { ... } (user data directly)
      const userData = body?.user || body;

      if (userData?.userId) {
        const userObj = {
          userId: userData.userId,
          screenName: userData.screenName ?? null,
          email: userData.email ?? null,
          emailProvided: userData.emailProvided ?? false,
          validated: userData.validated ?? false,
          avatar:
            typeof userData.avatar === "number" ? userData.avatar : Number(userData.avatar) || null,
        };
        setUser(userObj);

        // Backup session to localStorage for mobile/PWA resilience
        if (isMobile || isPWA) {
          localStorage.setItem(
            "auth:session",
            JSON.stringify({
              user: userObj,
              timestamp: Date.now(),
            })
          );
        }

        return;
      }
    } catch (err) {
      // network or parse error: clear user
      setUser(null);
      if (isMobile || isPWA) {
        localStorage.removeItem("auth:session");
      }
    }
    setUser(null);
  }, [apiBase, isMobile, isPWA]);

  // Attempt to restore an existing session once on mount. This will call the
  // protected `/auth/refresh` endpoint which will refresh tokens if needed and
  // return success if a valid session exists. We do this once so returning users
  // stay signed in without needing to manually sign in.
  //
  // Assumptions:
  // - The backend stores refresh tokens or session state in HttpOnly cookies.
  // - Calling `/auth/refresh` will refresh expired access tokens and return 200
  //   if a valid refresh token exists, or 401 if the session has expired.
  // After successful refresh, we call `/me` to get the user data.
  useEffect(() => {
    let mounted = true;
    (async () => {
      // loading is already true from initial state

      // First, clear any stale service worker caches for auth endpoints
      if ("caches" in window) {
        try {
          const cacheKeys = await caches.keys();
          for (const key of cacheKeys) {
            if (key.includes("api-cache") || key.includes("api-external-cache")) {
              const cache = await caches.open(key);
              const requests = await cache.keys();
              for (const request of requests) {
                if (request.url.includes("/auth/") || request.url.includes("/me")) {
                  await cache.delete(request);
                  console.log("Cleared stale auth cache:", request.url);
                }
              }
            }
          }
        } catch (e) {
          console.error("Error clearing auth caches:", e);
        }
      }

      try {
        // First try to refresh the session
        console.log("AuthProvider: Attempting session restoration");
        const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          cache: "no-store", // Bypass all caches
          // Add timeout for mobile/PWA contexts
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
        console.log("AuthProvider: /auth/refresh response:", refreshRes.status);
        if (refreshRes.ok) {
          // Session refreshed successfully, update timestamp and get user data
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
          console.log("AuthProvider: Refresh successful, fetching user data");
          await fetchMe();
        } else {
          console.log("AuthProvider: Refresh failed with status:", refreshRes.status);

          // For mobile/PWA, try to restore from localStorage backup
          if ((isMobile || isPWA) && refreshRes.status !== 200) {
            console.log("AuthProvider: Trying localStorage fallback");
            try {
              const backup = localStorage.getItem("auth:session");
              if (backup) {
                const { user: backupUser, timestamp } = JSON.parse(backup);
                // Only use backup if it's less than 24 hours old
                if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && backupUser?.userId) {
                  console.log("AuthProvider: Restored from localStorage backup");
                  setUser(backupUser);
                  // Try to refresh in background to get fresh tokens
                  setTimeout(() => {
                    fetch(`${apiBase}/auth/refresh`, {
                      method: "POST",
                      credentials: "include",
                    }).catch(() => {
                      // Ignore background refresh failures
                    });
                  }, 1000);
                  return;
                } else {
                  // Backup is too old, remove it
                  localStorage.removeItem("auth:session");
                }
              }
            } catch (e) {
              console.error("AuthProvider: Error parsing localStorage backup:", e);
              localStorage.removeItem("auth:session");
            }
          }

          // No valid session, clear user
          setUser(null);
        }
      } catch (err) {
        console.error("AuthProvider: Session restoration error:", err);

        // For mobile/PWA, try localStorage fallback even on network errors
        if (isMobile || isPWA) {
          console.log("AuthProvider: Network error, trying localStorage fallback");
          try {
            const backup = localStorage.getItem("auth:session");
            if (backup) {
              const { user: backupUser, timestamp } = JSON.parse(backup);
              // Only use backup if it's less than 12 hours old for network errors
              if (Date.now() - timestamp < 12 * 60 * 60 * 1000 && backupUser?.userId) {
                console.log("AuthProvider: Restored from localStorage backup (offline mode)");
                setUser(backupUser);
                return;
              } else {
                localStorage.removeItem("auth:session");
              }
            }
          } catch (e) {
            console.error("AuthProvider: Error parsing localStorage backup:", e);
            localStorage.removeItem("auth:session");
          }
        }

        // Network error or timeout, clear user
        setUser(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, isPWA]);

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
    // Clear localStorage backup on sign out
    localStorage.removeItem("auth:session");
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
  // Use 23 hours for desktop, 8 hours for mobile/PWA to ensure sessions persist
  const REFRESH_INTERVAL_MS = isMobile || isPWA ? 8 * 60 * 60 * 1000 : 23 * 60 * 60 * 1000; // 8 hours for mobile/PWA, 23 hours for desktop
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
      console.log("AuthProvider: Performing scheduled refresh");
      // Call proactive refresh endpoint; if it succeeds update timestamp & broadcast.
      const res = await fetch(`${apiBase}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        // Add timeout for mobile/PWA contexts
        signal: AbortSignal.timeout(8000), // 8 second timeout
      });
      console.log("AuthProvider: Scheduled refresh response:", res.status);
      if (res.ok) {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        bcRef.current?.postMessage({ type: "refreshed", at: Date.now() });
        // Optionally refresh user profile silently to reflect any changes.
        await refreshSession({ silent: true });
      } else if (res.status === 401) {
        console.log("AuthProvider: Scheduled refresh failed with 401, clearing user");
        // Refresh failed (maybe refresh token expired) — clear user locally.
        setUser(null);
      } else {
        console.log("AuthProvider: Scheduled refresh failed with status:", res.status);
      }
    } catch (err) {
      console.error("AuthProvider: Scheduled refresh error:", err);
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

  // On visibilitychange / focus: For desktop, only refresh if needed based on time.
  // For mobile/PWA: Use a debounced check to avoid aggressive re-checking that clears sessions.
  useEffect(() => {
    let timeoutId: number | null = null;

    async function onVisibilityOrFocus() {
      // Check if document is actually visible
      if (document.hidden) return;

      // Clear any pending timeout
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }

      console.log("AuthProvider: Visibility change detected");

      // For mobile/PWA: Debounce the check to avoid rapid re-checks
      if (isMobile || isPWA) {
        // Wait 500ms before checking - this prevents rapid-fire checks that can clear the session
        timeoutId = window.setTimeout(async () => {
          console.log("AuthProvider: Mobile/PWA debounced check");

          // Only check if we don't have a user
          if (!user) {
            console.log("AuthProvider: No user, trying localStorage restore");
            try {
              const backup = localStorage.getItem("auth:session");
              if (backup) {
                const { user: backupUser, timestamp } = JSON.parse(backup);
                if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && backupUser?.userId) {
                  console.log("AuthProvider: Restoring from localStorage");
                  setUser(backupUser);
                }
              }
            } catch (e) {
              console.error("AuthProvider: Error restoring from localStorage:", e);
            }
          }

          // Don't aggressively refresh on every visibility change - rely on the periodic refresh instead
        }, 500);
      } else {
        // Desktop behavior: only refresh if needed based on time
        if (!user) return;
        const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
        const now = Date.now();
        if (now - last > REFRESH_INTERVAL_MS - 10 * 60 * 1000) {
          void performScheduledRefresh();
        }
      }
    }

    window.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [user, performScheduledRefresh, isMobile, isPWA]);
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
