import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import {
  clearPostLoginRedirect,
  readPostLoginRedirect,
  rememberPostLoginRedirect,
  resumePostLoginRedirects,
} from '@/lib/auth/postLoginRedirect.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';

export default function AuthenticatedGuard() {
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const target = pathname + search;

  const requirementsUnmet =
    !!user &&
    ((user.requireTwoFactor && !user.twoFactorSatisfied) || (user.requireEmailVerification && !user.emailVerified));
  const onAccountSetupPage = pathname === '/account' || pathname === '/account/security-keys';

  const pendingRedirect = user && !requirementsUnmet ? readPostLoginRedirect() : null;

  if (user) resumePostLoginRedirects();

  useEffect(() => {
    if (pendingRedirect) clearPostLoginRedirect();
  }, [pendingRedirect]);

  if (!user) {
    rememberPostLoginRedirect(target);
    return <Navigate to='/auth/login' />;
  }

  if (requirementsUnmet && !onAccountSetupPage) {
    rememberPostLoginRedirect(target);
    return <Navigate to='/account' />;
  }

  if (pendingRedirect && pendingRedirect !== target) return <Navigate to={pendingRedirect} replace />;

  return <Outlet />;
}
