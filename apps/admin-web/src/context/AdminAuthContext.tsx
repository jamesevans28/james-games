import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { adminApi, normalizeAccount, AdminAccount } from "../lib/api";
import {
  auth,
  signInWithGoogle,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "../lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";

type AdminAuthContextType = {
  user: AdminAccount | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminAccount | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
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
        if (auth.currentUser) {
          await firebaseSignOut();
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        await hydrate();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [hydrate]);

  const handleSignInWithGoogle = useCallback(async () => {
    try {
      await signInWithGoogle();
      // onAuthStateChanged will handle the rest
    } catch (error) {
      console.error("Sign in error:", error);
      throw error;
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await firebaseSignOut();
    setUser(null);
    setFirebaseUser(null);
  }, []);

  const refresh = useCallback(async () => {
    await hydrate();
  }, [hydrate]);

  const value = useMemo(
    () => ({
      user,
      firebaseUser,
      loading,
      signInWithGoogle: handleSignInWithGoogle,
      signOut: handleSignOut,
      refresh,
    }),
    [user, firebaseUser, loading, handleSignInWithGoogle, handleSignOut, refresh]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
