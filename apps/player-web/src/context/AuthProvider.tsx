import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import {
  currentSession,
  getAccessToken,
  isAnonymousSession,
  linkedProviders,
  onAuthChange,
  signInAsAnonymous,
  signInWithTokenHash,
  signOut as supabaseSignOut,
  startSocialRedirect,
  type Session,
} from "../lib/supabase";
import { setAuthTokenGetter, type ExperienceSummary, type MeResponse } from "../lib/api";
import { adapters } from "../platform/adapters";
import { errorCode } from "../utils/errorCode";
import { API_BASE_URL } from "../config/env";

// Account types supported by the app
export type AccountType = "anonymous" | "username_pin" | "linked";

// Auth user shape exposed to components
export type AuthUser = {
  userId: string;
  screenName?: string | null;
  username?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  avatar?: number | null;
  experience?: ExperienceSummary | null;
  betaTester?: boolean;
  admin?: boolean;
  accountType: AccountType;
  providers: string[];
  isAnonymous: boolean;
};

// Result of username+PIN registration
type RegisterUsernameResult = {
  ok: boolean;
  screenName?: string;
  accountType?: AccountType;
};

type AuthContextType = {
  /** Current authenticated user or null when initializing */
  user: AuthUser | null;
  /** The Supabase session (for advanced use cases) */
  session: Session | null;
  /** Loading indicator for auth operations */
  loading: boolean;
  /** Whether initial auth state has been determined */
  initialized: boolean;
  /**
   * Sign in anonymously. This happens automatically on first visit,
   * but can be called explicitly if needed.
   */
  signInAnonymously: () => Promise<void>;
  /**
   * Register with username + PIN (upgrade from anonymous, keeping the same user id).
   * @param username - Unique username (3-20 chars, alphanumeric + underscore)
   * @param pin - 6-digit PIN
   * @param screenName - Optional display name (defaults to username)
   */
  registerWithUsername: (
    username: string,
    pin: string,
    screenName?: string,
  ) => Promise<RegisterUsernameResult>;
  /**
   * Sign in with existing username + PIN
   */
  signInWithUsername: (username: string, pin: string) => Promise<void>;
  /**
   * Sign in with Google. On the web the page leaves for Google and comes back to
   * /auth/callback, so this never resolves there. Hidden behind features.socialSignIn.
   */
  signInWithGoogle: () => Promise<void>;
  /**
   * Sign in with Apple (a redirect, like Google)
   */
  signInWithApple: () => Promise<void>;
  /**
   * Link Google account to current user (a guest keeps its id and progress)
   */
  linkGoogle: () => Promise<void>;
  /**
   * Link Apple account to current user
   */
  linkApple: () => Promise<void>;
  /**
   * Sign out and clear all auth state
   */
  signOut: () => Promise<void>;
  /**
   * Delete the account for good (DELETE /me, T7.8): the server removes the row and
   * the Supabase auth user. Call signOut() next, after leaving any signed-in-only
   * screen (otherwise its route guard redirects to the login page first).
   */
  deleteAccount: () => Promise<void>;
  /**
   * Refresh the user profile from the backend
   */
  refreshProfile: () => Promise<void>;
  /**
   * Get the current access token for API calls
   */
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  /**
   * Change PIN for username+PIN users
   */
  changePin: (currentPin: string, newPin: string) => Promise<void>;
  /**
   * Ensure a valid session exists (restore from token if needed).
   * Used to opportunistically refresh auth before critical actions.
   */
  ensureSession: (opts?: { silent?: boolean; reason?: string }) => Promise<void>;
};

const SESSION_CACHE_KEY = "g4j:authProfile";
const isBrowser = typeof window !== "undefined";

type CachedSession = {
  user: AuthUser;
  timestamp: number;
};

// Persist the profile to device storage so the UI has it before the network answers
function persistSession(user: AuthUser | null) {
  if (!isBrowser) return;
  if (!user) {
    adapters.storage.remove(SESSION_CACHE_KEY);
    return;
  }
  const payload: CachedSession = { user, timestamp: Date.now() };
  adapters.storage.set(SESSION_CACHE_KEY, JSON.stringify(payload));
}

// Read cached profile from device storage
function readCachedSession(maxAgeMs: number = 24 * 60 * 60 * 1000): AuthUser | null {
  if (!isBrowser) return null;
  try {
    const raw = adapters.storage.get(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    if (!parsed?.user) return null;
    if (Date.now() - parsed.timestamp > maxAgeMs) {
      adapters.storage.remove(SESSION_CACHE_KEY);
      return null;
    }
    return parsed.user;
  } catch {
    adapters.storage.remove(SESSION_CACHE_KEY);
    return null;
  }
}

/** What we know about a session's user before the backend has answered. */
function minimalUser(session: Session): AuthUser {
  const anonymous = isAnonymousSession(session);
  return {
    userId: session.user.id,
    email: null,
    emailVerified: false,
    screenName: null,
    accountType: anonymous ? "anonymous" : "linked",
    providers: linkedProviders(session),
    isAnonymous: anonymous,
  };
}

// Response bodies from the backend's /auth/* routes
// (apps/backend-api/src/controllers/authController.ts). GET /auth/me
// returns the same { user } shape as GET /me (MeResponse in lib/api.ts).

type RegisterAnonymousResponse = {
  ok: boolean;
  userId: string;
  screenName?: string | null;
  accountType?: AccountType;
  isNew?: boolean;
};

type RegisterUsernameResponse = {
  ok: boolean;
  tokenHash: string;
  screenName?: string;
  accountType?: AccountType;
};

type LoginUsernameResponse = {
  ok: boolean;
  tokenHash: string;
  userId: string;
  screenName?: string | null;
  accountType?: AccountType;
};

/** The `error` string from a failed API response body, if there is one. */
async function readApiError(res: Response): Promise<string | undefined> {
  const body: unknown = await res.json().catch(() => ({}));
  if (body && typeof body === "object") {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  // authReady: true when Supabase has restored (or failed to restore) the stored session
  const [authReady, setAuthReady] = useState(false);
  const apiBase = API_BASE_URL;
  const initRef = useRef(false);
  // The user id the current profile belongs to, so token refreshes don't refetch it.
  const profileUidRef = useRef<string | null>(null);

  // Wire up the token getter for API calls
  useEffect(() => {
    setAuthTokenGetter(() => getAccessToken());
  }, []);

  // Fetch user profile from our backend
  const fetchProfile = useCallback(
    async (s: Session): Promise<AuthUser | null> => {
      try {
        const res = await fetch(`${apiBase}/auth/me`, {
          headers: {
            Authorization: `Bearer ${s.access_token}`,
          },
        });
        if (!res.ok) {
          if (res.status === 404) {
            // Signed in with Supabase but no row in our database yet
            return null;
          }
          throw new Error("Failed to fetch profile");
        }
        const { user: data } = (await res.json()) as MeResponse;
        if (!data) return null;
        const authUser: AuthUser = {
          userId: data.userId,
          screenName: data.screenName,
          username: data.username,
          email: data.email,
          emailVerified: data.emailVerified,
          avatar: data.avatar,
          experience: data.experience,
          betaTester: data.betaTester,
          admin: data.admin,
          accountType: data.accountType,
          providers: data.providers.length ? data.providers : linkedProviders(s),
          isAnonymous: isAnonymousSession(s),
        };
        return authUser;
      } catch (err) {
        console.error("AuthProvider: fetchProfile error", errorCode(err));
        return null;
      }
    },
    [apiBase],
  );

  // Register anonymous user with our backend
  const registerAnonymousUser = useCallback(
    async (s: Session): Promise<AuthUser | null> => {
      try {
        const res = await fetch(`${apiBase}/auth/register-anonymous`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${s.access_token}`,
          },
        });
        if (!res.ok) {
          throw new Error("Failed to register anonymous user");
        }
        const data = (await res.json()) as RegisterAnonymousResponse;
        const authUser: AuthUser = {
          userId: data.userId,
          screenName: data.screenName,
          accountType: data.accountType || "anonymous",
          providers: [],
          isAnonymous: true,
        };
        return authUser;
      } catch (err) {
        console.error("AuthProvider: registerAnonymousUser error", errorCode(err));
        return null;
      }
    },
    [apiBase],
  );

  /**
   * Makes `s` the current session and loads its profile (registering a guest the
   * backend hasn't seen yet). Falls back to what the session itself says.
   */
  const applySession = useCallback(
    async (s: Session) => {
      setSession(s);
      profileUidRef.current = s.user.id;
      let profile = await fetchProfile(s);
      if (!profile && isAnonymousSession(s)) profile = await registerAnonymousUser(s);
      const next = profile ?? minimalUser(s);
      setUser(next);
      persistSession(next);
    },
    [fetchProfile, registerAnonymousUser],
  );

  // Restore the stored session (or start a guest one) and follow auth changes
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    // Show the cached profile immediately while Supabase restores the session (UI only)
    const cached = readCachedSession();
    if (cached) {
      setUser(cached);
    }

    void (async () => {
      try {
        const restored = await currentSession();
        // Supabase is ready - mark it immediately so hooks can proceed
        setAuthReady(true);
        try {
          await applySession(restored ?? (await signInAsAnonymous()));
        } catch (err) {
          console.error("AuthProvider: anonymous sign-in failed", errorCode(err));
          // Still ready, just no user
        }

        if (cancelled) return;
        unsubscribe = await onAuthChange((event, s) => {
          if (event === "SIGNED_OUT" || !s) {
            profileUidRef.current = null;
            setSession(null);
            setUser(null);
            persistSession(null);
            return;
          }
          setSession(s);
          // Token refreshes keep the same user; a different user needs its profile.
          // Deferred: Supabase asks callbacks not to await other work.
          if (s.user.id !== profileUidRef.current) {
            setTimeout(() => {
              // The flow that signed in may have loaded it meanwhile.
              if (s.user.id === profileUidRef.current) return;
              applySession(s).catch((err: unknown) =>
                console.error("AuthProvider: auth state change error", errorCode(err)),
              );
            }, 0);
          }
        });
      } catch (err) {
        console.error("AuthProvider: initialization error", errorCode(err));
        // Still mark as ready so app doesn't hang
        setAuthReady(true);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [applySession]);

  // Sign in anonymously
  const handleSignInAnonymously = useCallback(async () => {
    setLoading(true);
    try {
      await applySession(await signInAsAnonymous());
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  // Register with username + PIN
  const handleRegisterWithUsername = useCallback(
    async (username: string, pin: string, screenName?: string): Promise<RegisterUsernameResult> => {
      setLoading(true);
      try {
        // If not signed in, start a guest session first (it becomes the PIN account)
        let current = await currentSession();
        if (!current) {
          current = await signInAsAnonymous();
          setSession(current);
          await registerAnonymousUser(current);
        }

        const res = await fetch(`${apiBase}/auth/register-username`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${current.access_token}`,
          },
          body: JSON.stringify({ username, pin, screenName }),
        });
        if (!res.ok) {
          throw new Error((await readApiError(res)) || "Registration failed");
        }
        const data = (await res.json()) as RegisterUsernameResponse;

        // Same user id, now a PIN account: swap in its session and profile
        await applySession(await signInWithTokenHash(data.tokenHash));

        return {
          ok: true,
          screenName: data.screenName,
          accountType: data.accountType,
        };
      } finally {
        setLoading(false);
      }
    },
    [apiBase, applySession, registerAnonymousUser],
  );

  // Sign in with username + PIN
  const handleSignInWithUsername = useCallback(
    async (username: string, pin: string) => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/auth/login-username`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, pin }),
        });
        if (!res.ok) {
          throw new Error((await readApiError(res)) || "Sign in failed");
        }
        const data = (await res.json()) as LoginUsernameResponse;
        await applySession(await signInWithTokenHash(data.tokenHash));
      } finally {
        setLoading(false);
      }
    },
    [apiBase, applySession],
  );

  // Google and Apple: a redirect; /auth/callback finishes it (POST /auth/link-provider).
  const handleSignInWithGoogle = useCallback(() => startSocialRedirect("google", "signin"), []);
  const handleSignInWithApple = useCallback(() => startSocialRedirect("apple", "signin"), []);
  const handleLinkGoogle = useCallback(async () => {
    if (!session) throw new Error("Must be signed in to link accounts");
    await startSocialRedirect("google", "link");
  }, [session]);
  const handleLinkApple = useCallback(async () => {
    if (!session) throw new Error("Must be signed in to link accounts");
    await startSocialRedirect("apple", "link");
  }, [session]);

  // Ensure valid session exists
  const handleEnsureSession = useCallback(
    async (_opts?: { silent?: boolean; reason?: string }) => {
      // If we already have a user, we're good
      if (user && session) return;

      // If we have a session but no user profile, try to fetch it
      if (session && !user) {
        try {
          const profile = await fetchProfile(session);
          if (profile) {
            setUser(profile);
            persistSession(profile);
          }
        } catch (err) {
          console.error("ensureSession: failed to fetch profile", errorCode(err));
        }
        return;
      }

      // No user at all - try anonymous sign-in
      if (!user && !session) {
        try {
          await applySession(await signInAsAnonymous());
        } catch (err) {
          console.error("ensureSession: anonymous sign-in failed", errorCode(err));
        }
      }
    },
    [user, session, fetchProfile, applySession],
  );

  // Sign out
  const handleSignOut = useCallback(async () => {
    setLoading(true);
    try {
      await supabaseSignOut();
      profileUidRef.current = null;
      setUser(null);
      setSession(null);
      persistSession(null);
      // Don't auto sign-in anonymously - let user go to login page
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete the account (the server deletes the row and the Supabase auth user).
  const handleDeleteAccount = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("Must be signed in to delete your account");
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error((await readApiError(res)) || "We couldn't delete your account. Try again?");
      }
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  // Refresh profile from backend. Reads the session fresh, so it also works straight
  // after /auth/callback swapped it.
  const handleRefreshProfile = useCallback(async () => {
    const current = await currentSession();
    if (!current) return;
    setLoading(true);
    try {
      setSession(current);
      profileUidRef.current = current.user.id;
      const profile = await fetchProfile(current);
      if (profile) {
        setUser(profile);
        persistSession(profile);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  // Get access token
  const handleGetToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    return getAccessToken(forceRefresh);
  }, []);

  // Change PIN
  const handleChangePin = useCallback(
    async (currentPin: string, newPin: string) => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Must be signed in to change PIN");
      }
      const res = await fetch(`${apiBase}/auth/change-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPin, newPin }),
      });
      if (!res.ok) {
        throw new Error((await readApiError(res)) || "Failed to change PIN");
      }
    },
    [apiBase],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      loading,
      initialized: authReady,
      signInAnonymously: handleSignInAnonymously,
      registerWithUsername: handleRegisterWithUsername,
      signInWithUsername: handleSignInWithUsername,
      signInWithGoogle: handleSignInWithGoogle,
      signInWithApple: handleSignInWithApple,
      linkGoogle: handleLinkGoogle,
      linkApple: handleLinkApple,
      signOut: handleSignOut,
      deleteAccount: handleDeleteAccount,
      refreshProfile: handleRefreshProfile,
      getToken: handleGetToken,
      changePin: handleChangePin,
      ensureSession: handleEnsureSession,
    }),
    [
      user,
      session,
      loading,
      authReady,
      handleSignInAnonymously,
      handleRegisterWithUsername,
      handleSignInWithUsername,
      handleSignInWithGoogle,
      handleSignInWithApple,
      handleLinkGoogle,
      handleLinkApple,
      handleSignOut,
      handleDeleteAccount,
      handleRefreshProfile,
      handleGetToken,
      handleChangePin,
      handleEnsureSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Convenience hooks
export function useUser() {
  const { user } = useAuth();
  return user;
}

export function useIsAuthenticated() {
  const { user, initialized } = useAuth();
  return { isAuthenticated: !!user, initialized };
}

export function useIsAnonymous() {
  const { user } = useAuth();
  return user?.isAnonymous ?? true;
}

export function useAccountType() {
  const { user } = useAuth();
  return user?.accountType ?? "anonymous";
}
