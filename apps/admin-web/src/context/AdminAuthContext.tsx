import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { adminApi, normalizeAccount, type AdminAccount } from "../lib/api";
import { auth, signInWithGoogle, signOut as supabaseSignOut, type Session } from "../lib/supabase";

type AdminAuthContextType = {
  user: AdminAccount | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

/** A loggable code for an error, never the error itself (no PII in logs). */
function errorCode(err: unknown): string {
  const code = err && typeof err === "object" ? (err as { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : "error";
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminAccount | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    try {
      const payload = await adminApi.fetchMe().catch(() => null);
      const account = normalizeAccount(payload);
      if (account?.admin) {
        setUser(account);
      } else {
        setUser(null);
        // Not an admin, sign out
        await supabaseSignOut();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fires once with the restored session (INITIAL_SESSION), then on every change.
    const { data } = auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "TOKEN_REFRESHED") return;
      if (next) {
        // Deferred: Supabase asks callbacks not to await other work.
        setTimeout(() => void hydrate(), 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [hydrate]);

  const handleSignInWithGoogle = useCallback(async () => {
    try {
      // Leaves for Google; onAuthStateChange picks it up when the page comes back.
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in error:", errorCode(error));
      throw error;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await supabaseSignOut();
    setUser(null);
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    await hydrate();
  }, [hydrate]);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      signInWithGoogle: handleSignInWithGoogle,
      signOut: handleSignOut,
      refresh,
    }),
    [user, session, loading, handleSignInWithGoogle, handleSignOut, refresh],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
