import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../features/auth/auth-context';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-10 text-sm text-slate">Loading session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
