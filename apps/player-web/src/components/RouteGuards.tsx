import { Navigate, useLocation } from "react-router-dom";
import { ReactElement } from "react";
import { useAuth } from "../context/AuthProvider";

// Guard for routes that require authentication.
export function RequireAuth({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
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

// Guard for routes that require authenticated AND validated email.
// If not authenticated -> redirect to login.
// If authenticated but not validated -> redirect to settings with a reason.
export function RequireValidated({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (!user.validated) {
    return (
      <Navigate to="/settings" replace state={{ from: loc.pathname, reason: "email_required" }} />
    );
  }
  return children;
}
