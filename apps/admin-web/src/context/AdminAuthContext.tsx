import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { adminApi, normalizeAccount, AdminAccount } from "../lib/api";

type AdminAuthContextType = {
  user: AdminAccount | null;
  loading: boolean;
  signIn: (credentials: { username: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async () => {
    try {
      const payload = await adminApi.fetchMe().catch(() => null);
      const account = normalizeAccount(payload);
      if (account?.admin) {
        setUser(account);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await adminApi.refresh();
      } catch {
        /* ignore */
      }
      await hydrate();
    })();
  }, [hydrate]);

  const signIn = useCallback(
    async ({ username, password }: { username: string; password: string }) => {
      await adminApi.signIn({ username, password });
      const payload = await adminApi.fetchMe().catch(() => null);
      const account = normalizeAccount(payload);
      if (!account?.admin) {
        await adminApi.signOut();
        setUser(null);
        throw new Error("You do not have admin access.");
      }
      setUser(account);
    },
    []
  );

  const signOut = useCallback(async () => {
    await adminApi.signOut();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    await hydrate();
  }, [hydrate]);

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn,
      signOut,
      refresh,
    }),
    [user, loading, signIn, signOut, refresh]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
