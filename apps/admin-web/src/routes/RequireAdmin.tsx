import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { LoadingScreen } from "../components/common/LoadingScreen";

export function RequireAdmin() {
  const { user, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen label="Checking admin session" />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
