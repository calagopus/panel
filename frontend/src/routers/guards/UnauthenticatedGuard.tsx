import { Navigate, Outlet } from 'react-router';
import { safeSessionStorageGet, safeSessionStorageRemove } from '@/lib/safeStorage.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';

export default function UnauthenticatedGuard() {
  const { user } = useAuth();

  if (user) {
    const redirect = safeSessionStorageGet('post-login-redirect');
    if (redirect) {
      safeSessionStorageRemove('post-login-redirect');
      return <Navigate to={redirect} />;
    }
    return <Navigate to='/' />;
  }

  return <Outlet />;
}
