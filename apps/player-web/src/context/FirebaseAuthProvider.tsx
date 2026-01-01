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
  initializeFirebase,
  onAuthChange,
  signInAsAnonymous,
  signInWithToken,
  signInWithGoogle,
  signInWithApple,
  linkWithGoogle,
  linkWithApple,
  signOut as firebaseSignOut,
  getIdToken,
  getLinkedProviders,
  sendVerificationEmail,
  waitForAuthReady,
  type User as FirebaseUser,
} from "../lib/firebase";
import { setAuthTokenGetter, type ExperienceSummary } from "../lib/api";

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
  /** Raw Firebase user (for advanced use cases) */
  firebaseUser: FirebaseUser | null;
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
   * Register with username + PIN (upgrade from anonymous).
   * @param username - Unique username (3-20 chars, alphanumeric + underscore)
   * @param pin - 4-8 digit PIN
   * @param screenName - Optional display name (defaults to username)
   */
  registerWithUsername: (
    username: string,
    pin: string,
    screenName?: string
  ) => Promise<RegisterUsernameResult>;
  /**
   * Sign in with existing username + PIN
   */
  signInWithUsername: (username: string, pin: string) => Promise<void>;
  /**
   * Sign in with Google account
   */
  signInWithGoogle: () => Promise<void>;
  /**
   * Sign in with Apple account
   */
  signInWithApple: () => Promise<void>;
  /**
   * Link Google account to current user (upgrade anonymous or add provider)
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
   * Refresh the user profile from the backend
   */
  refreshProfile: () => Promise<void>;
  /**
   * Get the current Firebase ID token for API calls
   */
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  /**
   * Change PIN for username+PIN users
   */
  changePin: (currentPin: string, newPin: string) => Promise<void>;
  /**
   * Add email address to account
   */
  addEmail: (email: string) => Promise<void>;
  /**
   * Send verification email to the user's email address
   */
  sendVerificationEmail: () => Promise<void>;
  /**
   * Check if email has been verified and sync status
   */
  checkEmailVerified: () => Promise<boolean>;
  /**
   * Ensure a valid session exists (restore from token if needed).
   * Used to opportunistically refresh auth before critical actions.
   */
  ensureSession: (opts?: { silent?: boolean; reason?: string }) => Promise<void>;
};

const SESSION_CACHE_KEY = "auth:firebase:session";
const isBrowser = typeof window !== "undefined";

type CachedSession = {
  user: AuthUser;
  timestamp: number;
};

// Persist session to localStorage for offline support
function persistSession(user: AuthUser | null) {
  if (!isBrowser) return;
  if (!user) {
    window.localStorage.removeItem(SESSION_CACHE_KEY);
    return;
  }
  try {
    const payload: CachedSession = { user, timestamp: Date.now() };
    window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("FirebaseAuthProvider: unable to persist session", err);
  }
}

// Read cached session from localStorage
function readCachedSession(maxAgeMs: number = 24 * 60 * 60 * 1000): AuthUser | null {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    if (!parsed?.user) return null;
    if (Date.now() - parsed.timestamp > maxAgeMs) {
      window.localStorage.removeItem(SESSION_CACHE_KEY);
      return null;
    }
    return parsed.user;
  } catch {
    window.localStorage.removeItem(SESSION_CACHE_KEY);
    return null;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(false);
  // firebaseReady: true when Firebase SDK has resolved its initial auth state
  const [firebaseReady, setFirebaseReady] = useState(false);
  // initialized: true when we have determined auth state (either from Firebase or cache fallback)
  // For API calls that need auth, use firebaseReady instead
  const [initialized, setInitialized] = useState(false);
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
  const initRef = useRef(false);

  // Wire up the token getter for API calls
  useEffect(() => {
    setAuthTokenGetter(async () => {
      return getIdToken();
    });
  }, []);

  // Fetch user profile from our backend
  const fetchProfile = useCallback(
    async (fbUser: FirebaseUser): Promise<AuthUser | null> => {
      try {
        const token = await fbUser.getIdToken();
        const res = await fetch(`${apiBase}/auth/firebase/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          if (res.status === 404) {
            // User exists in Firebase but not in our DB yet
            return null;
          }
          throw new Error("Failed to fetch profile");
        }
        const data = await res.json();
        const authUser: AuthUser = {
          userId: data.userId,
          screenName: data.screenName,
          username: data.username,
          email: data.email || fbUser.email,
          emailVerified: data.emailVerified ?? fbUser.emailVerified,
          avatar: data.avatar,
          experience: data.experience,
          betaTester: data.betaTester,
          admin: data.admin,
          accountType: data.accountType || "anonymous",
          providers: data.providers || getLinkedProviders(fbUser),
          isAnonymous: fbUser.isAnonymous,
        };
        return authUser;
      } catch (err) {
        console.error("FirebaseAuthProvider: fetchProfile error", err);
        return null;
      }
    },
    [apiBase]
  );

  // Register anonymous user with our backend
  const registerAnonymousUser = useCallback(
    async (fbUser: FirebaseUser): Promise<AuthUser | null> => {
      try {
        const token = await fbUser.getIdToken();
        const res = await fetch(`${apiBase}/auth/firebase/register-anonymous`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ firebaseToken: token }),
        });
        if (!res.ok) {
          throw new Error("Failed to register anonymous user");
        }
        const data = await res.json();
        const authUser: AuthUser = {
          userId: data.userId,
          screenName: data.screenName,
          accountType: data.accountType || "anonymous",
          providers: [],
          isAnonymous: true,
        };
        return authUser;
      } catch (err) {
        console.error("FirebaseAuthProvider: registerAnonymousUser error", err);
        return null;
      }
    },
    [apiBase]
  );

  // Handle Firebase auth state changes
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    console.log("FirebaseAuthProvider: initializing...");

    // Initialize Firebase
    initializeFirebase();

    // Restore cached session immediately while Firebase initializes (for UI only)
    const cached = readCachedSession();
    if (cached) {
      console.log("FirebaseAuthProvider: restored cached session for UI", cached.userId);
      setUser(cached);
    }

    // Wait for Firebase Auth to be ready, then process
    (async () => {
      try {
        console.log("FirebaseAuthProvider: waiting for Firebase auth to be ready...");
        const currentUser = await waitForAuthReady();
        console.log("FirebaseAuthProvider: Firebase auth ready, user:", currentUser?.uid);

        // Firebase is now ready - mark it immediately so hooks can proceed
        setFirebaseReady(true);

        if (currentUser) {
          // User exists - fetch their profile
          setFirebaseUser(currentUser);
          let profile = await fetchProfile(currentUser);
          if (!profile && currentUser.isAnonymous) {
            console.log("FirebaseAuthProvider: registering anonymous user in backend");
            profile = await registerAnonymousUser(currentUser);
          }
          if (profile) {
            setUser(profile);
            persistSession(profile);
          } else {
            const minimalUser: AuthUser = {
              userId: currentUser.uid,
              email: currentUser.email,
              emailVerified: currentUser.emailVerified,
              screenName: currentUser.displayName,
              accountType: currentUser.isAnonymous ? "anonymous" : "linked",
              providers: getLinkedProviders(currentUser),
              isAnonymous: currentUser.isAnonymous,
            };
            setUser(minimalUser);
            persistSession(minimalUser);
          }
        } else {
          // No user - sign in anonymously
          console.log("FirebaseAuthProvider: no user, signing in anonymously...");
          try {
            const result = await signInAsAnonymous();
            const fbUser = result.user;
            setFirebaseUser(fbUser);

            let profile = await fetchProfile(fbUser);
            if (!profile) {
              console.log("FirebaseAuthProvider: registering new anonymous user");
              profile = await registerAnonymousUser(fbUser);
            }
            if (profile) {
              setUser(profile);
              persistSession(profile);
            } else {
              const minimalUser: AuthUser = {
                userId: fbUser.uid,
                email: null,
                emailVerified: false,
                screenName: null,
                accountType: "anonymous",
                providers: [],
                isAnonymous: true,
              };
              setUser(minimalUser);
              persistSession(minimalUser);
            }
          } catch (err) {
            console.error("FirebaseAuthProvider: anonymous sign-in failed", err);
            // Still ready, just no user
          }
        }
      } catch (err) {
        console.error("FirebaseAuthProvider: initialization error", err);
        // Still mark as ready so app doesn't hang
        setFirebaseReady(true);
      } finally {
        setInitialized(true);
      }
    })();

    // Subscribe to future auth state changes
    const unsubscribe = onAuthChange(async (fbUser) => {
      console.log("FirebaseAuthProvider: auth state changed", fbUser?.uid, fbUser?.isAnonymous);
      setFirebaseUser(fbUser);

      if (!fbUser) {
        console.log("FirebaseAuthProvider: user signed out");
        setUser(null);
        persistSession(null);
        return;
      }

      // User signed in - update profile
      try {
        let profile = await fetchProfile(fbUser);

        if (!profile && fbUser.isAnonymous) {
          console.log("FirebaseAuthProvider: registering anonymous user in backend");
          profile = await registerAnonymousUser(fbUser);
        }

        if (profile) {
          console.log("FirebaseAuthProvider: setting user from profile", profile.userId);
          setUser(profile);
          persistSession(profile);
        } else {
          const minimalUser: AuthUser = {
            userId: fbUser.uid,
            email: fbUser.email,
            emailVerified: fbUser.emailVerified,
            screenName: fbUser.displayName,
            accountType: fbUser.isAnonymous ? "anonymous" : "linked",
            providers: getLinkedProviders(fbUser),
            isAnonymous: fbUser.isAnonymous,
          };
          setUser(minimalUser);
          persistSession(minimalUser);
        }
      } catch (err) {
        console.error("FirebaseAuthProvider: auth state change error", err);
        const minimalUser: AuthUser = {
          userId: fbUser.uid,
          email: fbUser.email,
          emailVerified: fbUser.emailVerified,
          screenName: fbUser.displayName,
          accountType: fbUser.isAnonymous ? "anonymous" : "linked",
          providers: getLinkedProviders(fbUser),
          isAnonymous: fbUser.isAnonymous,
        };
        setUser(minimalUser);
        persistSession(minimalUser);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchProfile, registerAnonymousUser]);

  // Sign in anonymously
  const handleSignInAnonymously = useCallback(async () => {
    setLoading(true);
    try {
      const result = await signInAsAnonymous();
      const fbUser = result.user;
      setFirebaseUser(fbUser);

      // Register with backend and set user
      const profile = await registerAnonymousUser(fbUser);
      if (profile) {
        setUser(profile);
        persistSession(profile);
      } else {
        const minimalUser: AuthUser = {
          userId: fbUser.uid,
          email: null,
          emailVerified: false,
          screenName: null,
          accountType: "anonymous",
          providers: [],
          isAnonymous: true,
        };
        setUser(minimalUser);
        persistSession(minimalUser);
      }
    } finally {
      setLoading(false);
    }
  }, [registerAnonymousUser]);

  // Register with username + PIN
  const handleRegisterWithUsername = useCallback(
    async (username: string, pin: string, screenName?: string): Promise<RegisterUsernameResult> => {
      setLoading(true);
      try {
        // If not signed in, sign in anonymously first
        let currentFbUser = firebaseUser;
        if (!currentFbUser) {
          const result = await signInAsAnonymous();
          currentFbUser = result.user;
          setFirebaseUser(currentFbUser);
          // Also register anonymous user in backend
          await registerAnonymousUser(currentFbUser);
        }

        const token = await currentFbUser.getIdToken();
        const res = await fetch(`${apiBase}/auth/firebase/register-username`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            pin,
            screenName,
            firebaseToken: token,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Registration failed");
        }
        const data = await res.json();

        // Sign in with the custom token to get updated claims
        if (data.customToken) {
          const credential = await signInWithToken(data.customToken);
          currentFbUser = credential.user;
          setFirebaseUser(currentFbUser);
        }

        // Refresh profile with the new token user
        const profile = await fetchProfile(currentFbUser);
        if (profile) {
          setUser(profile);
          persistSession(profile);
        }

        return {
          ok: true,
          screenName: data.screenName,
          accountType: data.accountType,
        };
      } finally {
        setLoading(false);
      }
    },
    [firebaseUser, apiBase, fetchProfile]
  );

  // Sign in with username + PIN
  const handleSignInWithUsername = useCallback(
    async (username: string, pin: string) => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/auth/firebase/login-username`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, pin }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Sign in failed");
        }
        const data = await res.json();

        // Sign in with the custom token
        const credential = await signInWithToken(data.customToken);
        const fbUser = credential.user;
        setFirebaseUser(fbUser);

        // Manually fetch and set profile since onAuthStateChanged may not fire
        const profile = await fetchProfile(fbUser);
        if (profile) {
          setUser(profile);
          persistSession(profile);
        } else {
          // Build minimal user from response
          const minimalUser: AuthUser = {
            userId: data.userId,
            screenName: data.screenName,
            accountType: data.accountType || "username_pin",
            providers: [],
            isAnonymous: false,
          };
          setUser(minimalUser);
          persistSession(minimalUser);
        }
      } finally {
        setLoading(false);
      }
    },
    [apiBase, fetchProfile]
  );

  // Sign in with Google
  const handleSignInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      const fbUser = result.user;
      setFirebaseUser(fbUser);

      // Register/update the user in our backend
      const token = await fbUser.getIdToken();
      await fetch(`${apiBase}/auth/firebase/link-provider`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ firebaseToken: token }),
      });

      // Fetch profile and set user
      const profile = await fetchProfile(fbUser);
      if (profile) {
        setUser(profile);
        persistSession(profile);
      } else {
        const minimalUser: AuthUser = {
          userId: fbUser.uid,
          email: fbUser.email,
          emailVerified: fbUser.emailVerified,
          screenName: fbUser.displayName,
          accountType: "linked",
          providers: getLinkedProviders(fbUser),
          isAnonymous: false,
        };
        setUser(minimalUser);
        persistSession(minimalUser);
      }
    } finally {
      setLoading(false);
    }
  }, [apiBase, fetchProfile]);

  // Sign in with Apple
  const handleSignInWithApple = useCallback(async () => {
    setLoading(true);
    try {
      const result = await signInWithApple();
      const fbUser = result.user;
      setFirebaseUser(fbUser);

      // Register/update the user in our backend
      const token = await fbUser.getIdToken();
      await fetch(`${apiBase}/auth/firebase/link-provider`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ firebaseToken: token }),
      });

      // Fetch profile and set user
      const profile = await fetchProfile(fbUser);
      if (profile) {
        setUser(profile);
        persistSession(profile);
      } else {
        const minimalUser: AuthUser = {
          userId: fbUser.uid,
          email: fbUser.email,
          emailVerified: fbUser.emailVerified,
          screenName: fbUser.displayName,
          accountType: "linked",
          providers: getLinkedProviders(fbUser),
          isAnonymous: false,
        };
        setUser(minimalUser);
        persistSession(minimalUser);
      }
    } finally {
      setLoading(false);
    }
  }, [apiBase, fetchProfile]);

  // Link Google account
  const handleLinkGoogle = useCallback(async () => {
    if (!firebaseUser) {
      throw new Error("Must be signed in to link accounts");
    }
    setLoading(true);
    try {
      await linkWithGoogle(firebaseUser);
      // Update backend
      const token = await firebaseUser.getIdToken(true);
      await fetch(`${apiBase}/auth/firebase/link-provider`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ firebaseToken: token }),
      });
      // Refresh profile
      const profile = await fetchProfile(firebaseUser);
      if (profile) {
        setUser(profile);
        persistSession(profile);
      }
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, apiBase, fetchProfile]);

  // Link Apple account
  const handleLinkApple = useCallback(async () => {
    if (!firebaseUser) {
      throw new Error("Must be signed in to link accounts");
    }
    setLoading(true);
    try {
      await linkWithApple(firebaseUser);
      // Update backend
      const token = await firebaseUser.getIdToken(true);
      await fetch(`${apiBase}/auth/firebase/link-provider`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ firebaseToken: token }),
      });
      // Refresh profile
      const profile = await fetchProfile(firebaseUser);
      if (profile) {
        setUser(profile);
        persistSession(profile);
      }
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, apiBase, fetchProfile]);

  // Ensure valid session exists
  const handleEnsureSession = useCallback(
    async (_opts?: { silent?: boolean; reason?: string }) => {
      // If we already have a user, we're good
      if (user && firebaseUser) return;

      // If we have a firebaseUser but no user profile, try to fetch it
      if (firebaseUser && !user) {
        try {
          const profile = await fetchProfile(firebaseUser);
          if (profile) {
            setUser(profile);
            persistSession(profile);
          }
        } catch (err) {
          console.error("ensureSession: failed to fetch profile", err);
        }
        return;
      }

      // No user at all - try anonymous sign-in
      if (!user && !firebaseUser) {
        try {
          await signInAsAnonymous();
        } catch (err) {
          console.error("ensureSession: anonymous sign-in failed", err);
        }
      }
    },
    [user, firebaseUser, fetchProfile]
  );

  // Sign out
  const handleSignOut = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseSignOut();
      setUser(null);
      setFirebaseUser(null);
      persistSession(null);
      // Don't auto sign-in anonymously - let user go to login page
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh profile from backend
  const handleRefreshProfile = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const profile = await fetchProfile(firebaseUser);
      if (profile) {
        setUser(profile);
        persistSession(profile);
      }
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, fetchProfile]);

  // Get ID token
  const handleGetToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    return getIdToken(forceRefresh);
  }, []);

  // Change PIN
  const handleChangePin = useCallback(
    async (currentPin: string, newPin: string) => {
      if (!firebaseUser) {
        throw new Error("Must be signed in to change PIN");
      }
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${apiBase}/auth/firebase/change-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPin, newPin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to change PIN");
      }
    },
    [firebaseUser, apiBase]
  );

  // Add email to account
  const handleAddEmail = useCallback(
    async (email: string) => {
      if (!firebaseUser) {
        throw new Error("Must be signed in to add email");
      }
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${apiBase}/auth/firebase/add-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to add email");
      }
      // Refresh profile to get updated email
      const profile = await fetchProfile(firebaseUser);
      if (profile) {
        setUser(profile);
        persistSession(profile);
      }
    },
    [firebaseUser, apiBase, fetchProfile]
  );

  // Send verification email
  const handleSendVerificationEmail = useCallback(async () => {
    if (!firebaseUser) {
      throw new Error("Must be signed in to send verification email");
    }
    // Use Firebase client SDK to send verification email
    await sendVerificationEmail(firebaseUser);
  }, [firebaseUser]);

  // Check email verification status
  const handleCheckEmailVerified = useCallback(async (): Promise<boolean> => {
    if (!firebaseUser) {
      return false;
    }
    // Reload Firebase user to get fresh emailVerified status
    await firebaseUser.reload();
    const isVerified = firebaseUser.emailVerified;

    if (isVerified) {
      // Sync to backend
      const token = await firebaseUser.getIdToken(true);
      await fetch(`${apiBase}/auth/firebase/check-email-verified`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      // Refresh profile
      const profile = await fetchProfile(firebaseUser);
      if (profile) {
        setUser(profile);
        persistSession(profile);
      }
    }

    return isVerified;
  }, [firebaseUser, apiBase, fetchProfile]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      firebaseUser,
      loading,
      initialized: firebaseReady, // Use firebaseReady as the source of truth for "initialized"
      signInAnonymously: handleSignInAnonymously,
      registerWithUsername: handleRegisterWithUsername,
      signInWithUsername: handleSignInWithUsername,
      signInWithGoogle: handleSignInWithGoogle,
      signInWithApple: handleSignInWithApple,
      linkGoogle: handleLinkGoogle,
      linkApple: handleLinkApple,
      signOut: handleSignOut,
      refreshProfile: handleRefreshProfile,
      getToken: handleGetToken,
      changePin: handleChangePin,
      addEmail: handleAddEmail,
      sendVerificationEmail: handleSendVerificationEmail,
      checkEmailVerified: handleCheckEmailVerified,
      ensureSession: handleEnsureSession,
    }),
    [
      user,
      firebaseUser,
      loading,
      firebaseReady,
      handleSignInAnonymously,
      handleRegisterWithUsername,
      handleSignInWithUsername,
      handleSignInWithGoogle,
      handleSignInWithApple,
      handleLinkGoogle,
      handleLinkApple,
      handleSignOut,
      handleRefreshProfile,
      handleGetToken,
      handleChangePin,
      handleAddEmail,
      handleSendVerificationEmail,
      handleCheckEmailVerified,
      handleEnsureSession,
    ]
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
