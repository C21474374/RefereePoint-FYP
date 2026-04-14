import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { JSX } from "react";
import type { CurrentUser } from "../services/auth";

type ProtectedRouteProps = {
  children: JSX.Element;
  allow?: (user: CurrentUser | null) => boolean;
  redirectTo?: string;
};

export default function ProtectedRoute({
  children,
  allow,
  redirectTo = "/dashboard",
}: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allow && !allow(user)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
