import { Navigate, Outlet } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';

/**
 * Wraps routes that should only be reachable by certain roles (e.g. Command
 * Center is admin/supervisor only). Renders nothing while the workspace is
 * still loading to avoid a flash-redirect before `role` is known.
 */
export default function RoleProtectedRoute({ check, redirectTo = '/tasks' }) {
  const { role, loading } = useWorkspace();

  if (loading) return null;
  if (!check(role)) return <Navigate to={redirectTo} replace />;

  return <Outlet />;
}
