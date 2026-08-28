import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/providers/AuthProvider.tsx';

export default function AuthenticatedGuard() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  if (!user) return <Navigate to='/auth/login' />;
  if (
    pathname !== '/account' &&
    pathname !== '/account/security-keys' &&
    ((user.requireTwoFactor && !user.twoFactorSatisfied) || (user.requireEmailVerification && !user.emailVerified))
  )
    return <Navigate to='/account' />;

  return <Outlet />;
}
