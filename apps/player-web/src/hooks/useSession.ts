import { useMemo } from "react";
import { useAuth } from "../context/FirebaseAuthProvider";

// useSession now delegates to the central FirebaseAuthProvider.
// Components should use `useSession` or `useAuth` — both will reflect the
// same authenticated state. `useSession` returns the full user object (or null)
// so UI components can access profile fields such as `avatar`, `screenName`, etc.
export function useSession() {
  const { user, loading, refreshProfile, initialized } = useAuth();

  // Return the raw user object from AuthProvider so callers can access
  // additional profile fields (avatar, screenName, accountType...).
  // Keep useMemo to avoid ref churn for consumers.
  const sessionUser = useMemo(() => (user ? (user as any) : null), [user]);
  return { user: sessionUser, loading, initialized, refresh: refreshProfile };
}
