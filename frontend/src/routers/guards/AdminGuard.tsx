import { Navigate, Outlet } from 'react-router';
import { isAdmin } from '@/lib/auth/permissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';

export default function AdminGuard() {
  const { user } = useAuth();

  if (!isAdmin(user)) return <Navigate to='/' />;

  return <Outlet />;
}
