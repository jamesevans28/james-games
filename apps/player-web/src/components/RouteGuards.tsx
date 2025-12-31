import { Navigate, useLocation } from "react-router-dom";
import { ReactElement } from "react";
import { useAuth } from "../context/FirebaseAuthProvider";

// Guard for routes that require any authentication (including anonymous).
export function RequireAuth({ children }: { children: ReactElement }) {
  const { user, loading, initialized } = useAuth();
  const loc = useLocation();

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return children;
}

// Guard for routes that require a registered account (not anonymous).
// Anonymous users are redirected to login to upgrade their account.
export function RequireRegistered({ children }: { children: ReactElement }) {
  const { user, loading, initialized } = useAuth();
  const loc = useLocation();

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  // If user is anonymous, redirect to login to upgrade
  if (user.isAnonymous || user.accountType === "anonymous") {
    return (
      <Navigate to="/login" replace state={{ from: loc.pathname, reason: "account_required" }} />
    );
  }

  return children;
}

// Guard for routes that require a linked account with verified email.
export function RequireVerifiedEmail({ children }: { children: ReactElement }) {
  const { user, loading, initialized } = useAuth();
  const loc = useLocation();

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  if (!user.email || !user.emailVerified) {
    return (
      <Navigate to="/settings" replace state={{ from: loc.pathname, reason: "email_required" }} />
    );
  }

  return children;
}

// Legacy export for backwards compatibility
export const RequireValidated = RequireVerifiedEmail;
