import { Navigate, Outlet, useLocation } from 'react-router';
import { useGlobalStore } from '@/stores/global.ts';

export default function OobeGuard() {
  const settings = useGlobalStore((state) => state.settings);
  const location = useLocation();

  const inOobe = location.pathname.startsWith('/oobe');
  const oobeCompleted = settings.oobeStep === null;

  if (!oobeCompleted && !inOobe) {
    return <Navigate to='/oobe' />;
  }

  if (oobeCompleted && inOobe) {
    return <Navigate to='/' />;
  }

  return <Outlet />;
}
