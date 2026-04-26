import type { GlobalRouteDefinition } from 'shared';
import ForgotPassword from '@/pages/auth/ForgotPassword.tsx';
import Login from '@/pages/auth/Login.tsx';
import LoginCheckpoint from '@/pages/auth/LoginSteps/LoginCheckpoint.tsx';
import LoginOAuth from '@/pages/auth/LoginSteps/LoginOAuth.tsx';
import Register from '@/pages/auth/Register.tsx';
import ResetPassword from '@/pages/auth/ResetPassword.tsx';

const routes: GlobalRouteDefinition[] = [
  {
    path: '/login',
    element: Login,
  },
  {
    path: '/login/checkpoint',
    element: LoginCheckpoint,
  },
  {
    path: '/login/oauth',
    element: LoginOAuth,
  },
  {
    path: '/register',
    element: Register,
  },
  {
    path: '/forgot-password',
    element: ForgotPassword,
  },
  {
    path: '/reset-password',
    element: ResetPassword,
  },
];

export default routes;
