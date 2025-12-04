import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ExperienceSummary } from "../lib/api";
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
  experience?: ExperienceSummary | null;
  betaTester?: boolean;
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

const SESSION_CACHE_KEY = "auth:session";
const LAST_REFRESH_KEY = "auth:lastRefresh";
const SESSION_CACHE_MAX_AGE = 180 * 24 * 60 * 60 * 1000; // ~6 months
const OFFLINE_CACHE_GRACE_MS = 24 * 60 * 60 * 1000; // allow 24h offline before forcing re-login
const isBrowser = typeof window !== "undefined";

type CachedSession = {
  user: AuthUser;
  timestamp: number;
};

function persistSessionCache(user: AuthUser | null) {
  if (!isBrowser) return;
  if (!user) {
    window.localStorage.removeItem(SESSION_CACHE_KEY);
    return;
  }
  try {
    const payload: CachedSession = { user, timestamp: Date.now() };
    window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("AuthProvider: unable to persist session cache", err);
  }
}

function readSessionCache(maxAge: number = SESSION_CACHE_MAX_AGE): AuthUser | null {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    if (!parsed?.user) return null;
    if (parsed.timestamp && Date.now() - parsed.timestamp > maxAge) {
      window.localStorage.removeItem(SESSION_CACHE_KEY);
      return null;
    }
    return parsed.user;
  } catch (err) {
    console.error("AuthProvider: unable to read session cache", err);
    window.localStorage.removeItem(SESSION_CACHE_KEY);
    return null;
  }
}

function clearSessionCache() {
  if (!isBrowser) return;
  window.localStorage.removeItem(SESSION_CACHE_KEY);
}

function setLastRefreshTimestamp(ts: number) {
  if (!isBrowser) return;
  window.localStorage.setItem(LAST_REFRESH_KEY, String(ts));
}

function getLastRefreshTimestamp() {
  if (!isBrowser) return 0;
  const raw = window.localStorage.getItem(LAST_REFRESH_KEY);
  return raw ? Number(raw) || 0 : 0;
}

function clearLastRefreshTimestamp() {
  if (!isBrowser) return;
  window.localStorage.removeItem(LAST_REFRESH_KEY);
}

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

  const hydrateUserFromCache = useCallback(
    (maxAge: number = SESSION_CACHE_MAX_AGE) => {
      const cached = readSessionCache(maxAge);
      if (cached) {
        setUser((prev) => prev ?? cached);
        persistSessionCache(cached);
        return cached;
      }
      return null;
    },
    [setUser]
  );

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
        if (res.status === 401) {
          setUser(null);
          clearSessionCache();
        }
        return null;
      }
      const body = await res.json();

      // Handle both response formats: { user: {...} } or { ... } (user data directly)
      const userData = body?.user || body;

      if (userData?.userId) {
        const userObj: AuthUser = {
          userId: userData.userId,
          screenName: userData.screenName ?? null,
          email: userData.email ?? null,
          emailProvided: userData.emailProvided ?? false,
          validated: userData.validated ?? false,
          avatar:
            typeof userData.avatar === "number" ? userData.avatar : Number(userData.avatar) || null,
          experience: userData.experience ?? null,
          betaTester: Boolean(userData.betaTester),
        };
        setUser(userObj);
        persistSessionCache(userObj);
        return userObj;
      }
    } catch (err) {
      console.error("AuthProvider: /me request failed", err);
    }
    return null;
  }, [apiBase]);

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
        const fetched = await fetchMe();
        if (!fetched) hydrateUserFromCache();
      } finally {
        setLoading(false);
      }
    },
    [apiBase, fetchMe, hydrateUserFromCache]
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
        const fetched = await fetchMe();
        if (!fetched) hydrateUserFromCache();
      } finally {
        setLoading(false);
      }
    },
    [apiBase, fetchMe, hydrateUserFromCache]
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
    // Clear local storage backups on sign out
    persistSessionCache(null);
    clearLastRefreshTimestamp();
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
        const fetched = await fetchMe();
        if (!fetched) hydrateUserFromCache(OFFLINE_CACHE_GRACE_MS);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [fetchMe, hydrateUserFromCache]
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
  const bcRef = React.useRef<BroadcastChannel | null>(null);
  const intervalRef = React.useRef<number | null>(null);

  type RefreshOutcome = "success" | "unauthorized" | "failed";

  const runRefresh = useCallback(
    async ({
      reason = "manual",
      broadcast = true,
      timeoutMs = 10000,
    }: {
      reason?: string;
      broadcast?: boolean;
      timeoutMs?: number;
    } = {}): Promise<RefreshOutcome> => {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
      const timeoutId =
        controller && typeof window !== "undefined"
          ? window.setTimeout(() => controller.abort(), timeoutMs)
          : null;
      try {
        const res = await fetch(`${apiBase}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          signal: controller?.signal,
        });
        if (res.ok) {
          const stamp = Date.now();
          setLastRefreshTimestamp(stamp);
          if (broadcast) {
            bcRef.current?.postMessage({ type: "refreshed", at: stamp, reason });
          }
          return "success";
        }
        if (res.status === 401) {
          return "unauthorized";
        }
        return "failed";
      } catch (err) {
        console.error("AuthProvider: refresh error", err);
        return "failed";
      } finally {
        if (timeoutId !== null && typeof window !== "undefined") {
          window.clearTimeout(timeoutId);
        }
      }
    },
    [apiBase]
  );

  const handleUnauthorized = useCallback(() => {
    const cached = readSessionCache(SESSION_CACHE_MAX_AGE);
    if (cached) {
      setUser(cached);
      persistSessionCache(cached);
      return;
    }
    clearSessionCache();
    setUser(null);
  }, []);

  const performScheduledRefresh = useCallback(async () => {
    if (!user) return;
    const last = getLastRefreshTimestamp();
    const now = Date.now();
    if (now - last < MIN_SPACING_MS) return; // another tab refreshed recently
    try {
      console.log("AuthProvider: Performing scheduled refresh");
      const outcome = await runRefresh({ reason: "interval" });
      if (outcome === "success") {
        await refreshSession({ silent: true });
      } else if (outcome === "unauthorized") {
        handleUnauthorized();
      }
    } catch (err) {
      console.error("AuthProvider: Scheduled refresh error:", err);
    }
  }, [user, runRefresh, refreshSession, handleUnauthorized]);

  useEffect(() => {
    let mounted = true;

    const cachedUser = readSessionCache();
    if (cachedUser) {
      setUser((prev) => prev ?? cachedUser);
      setLoading(false);
    }

    const restoreSession = async () => {
      if (typeof window !== "undefined" && "caches" in window) {
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
        console.log("AuthProvider: Attempting session restoration");
        const outcome = await runRefresh({ reason: "startup", timeoutMs: 10000 });
        if (outcome === "success") {
          console.log("AuthProvider: Refresh successful, fetching user data");
          const fetched = await fetchMe();
          if (!fetched) {
            hydrateUserFromCache(OFFLINE_CACHE_GRACE_MS);
          }
          return;
        }

        if (outcome === "unauthorized") {
          console.log("AuthProvider: Refresh returned 401, user must reauthenticate");
          handleUnauthorized();
          return;
        }

        const fallbackUser = readSessionCache(OFFLINE_CACHE_GRACE_MS);
        if (fallbackUser) {
          console.log("AuthProvider: Using cached session while offline");
          setUser(fallbackUser);
          return;
        }

        clearSessionCache();
        setUser(null);
      } catch (err) {
        console.error("AuthProvider: Session restoration error:", err);
        const fallbackUser = readSessionCache(OFFLINE_CACHE_GRACE_MS);
        if (fallbackUser) {
          console.log("AuthProvider: Restored from cache after error");
          setUser(fallbackUser);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    const onlineHandler = () => {
      void (async () => {
        const outcome = await runRefresh({ reason: "online" });
        if (outcome === "success") {
          const fetched = await fetchMe();
          if (!fetched) hydrateUserFromCache(OFFLINE_CACHE_GRACE_MS);
        } else if (outcome === "unauthorized") {
          handleUnauthorized();
        }
      })();
    };

    window.addEventListener("online", onlineHandler);

    return () => {
      mounted = false;
      window.removeEventListener("online", onlineHandler);
    };
  }, [fetchMe, runRefresh, handleUnauthorized, hydrateUserFromCache]);

  // Listen for broadcasts from other tabs so each tab stays in sync.
  useEffect(() => {
    bcRef.current = new BroadcastChannel("auth-refresh");
    const bc = bcRef.current;
    bc.onmessage = (ev) => {
      if (ev?.data?.type === "refreshed") {
        // Update local timestamp; no need to call /me again.
        setLastRefreshTimestamp(ev?.data?.at || Date.now());
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
            const backupUser = readSessionCache(OFFLINE_CACHE_GRACE_MS);
            if (backupUser) {
              console.log("AuthProvider: Restoring from cached session");
              setUser(backupUser);
            }
          }

          // Don't aggressively refresh on every visibility change - rely on the periodic refresh instead
        }, 500);
      } else {
        // Desktop behavior: only refresh if needed based on time
        if (!user) return;
        const last = getLastRefreshTimestamp();
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

  // Global fetch interceptor: automatically refresh when a protected call returns 401.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.fetch !== "function" || !apiBase) {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    let refreshPromise: Promise<RefreshOutcome> | null = null;
    const normalizedApi = apiBase.replace(/\/$/, "");

    const shouldBypass = (url: string) => {
      return (
        url.includes("/auth/refresh") ||
        url.includes("/auth/local-signin") ||
        url.includes("/auth/local-signup") ||
        url.includes("/auth/logout")
      );
    };

    const shouldMonitor = (url: string) => {
      return normalizedApi && url.startsWith(normalizedApi);
    };

    const ensureRefreshed = async () => {
      if (!refreshPromise) {
        refreshPromise = (async () => {
          const outcome = await runRefresh({ reason: "fetch-401" });
          if (outcome === "success") {
            await refreshSession({ silent: true });
          } else if (outcome === "unauthorized") {
            handleUnauthorized();
          }
          return outcome;
        })().finally(() => {
          refreshPromise = null;
        });
      }
      return refreshPromise;
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const response = await originalFetch(request.clone());

      if (
        response.status !== 401 ||
        !user ||
        !shouldMonitor(request.url) ||
        shouldBypass(request.url) ||
        request.headers.get("x-auth-retry") === "1"
      ) {
        return response;
      }

      const outcome = await ensureRefreshed();
      if (outcome !== "success") {
        return response;
      }

      const retryHeaders = new Headers(request.headers);
      retryHeaders.set("x-auth-retry", "1");
      const retriedRequest = new Request(request, { headers: retryHeaders });
      const retryResponse = await originalFetch(retriedRequest);
      if (retryResponse.status === 401) {
        handleUnauthorized();
      }
      return retryResponse;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [user, apiBase, runRefresh, refreshSession, handleUnauthorized]);
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
