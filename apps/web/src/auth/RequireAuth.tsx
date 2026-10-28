import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="page-center" role="status">
        Loading…
      </div>
    );
  }
  if (!session) {
    const next = location.pathname + location.search;
    return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
}
