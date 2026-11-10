import type { GlobalRouteDefinition } from 'shared';
import ForgotPassword from '@/pages/auth/ForgotPassword.tsx';
import LoginCheckpoint from '@/pages/auth/login-steps/LoginCheckpoint.tsx';
import LoginOAuth from '@/pages/auth/login-steps/LoginOAuth.tsx';
import Login from '@/pages/auth/Login.tsx';
import Register from '@/pages/auth/Register.tsx';
import ResetPassword from '@/pages/auth/ResetPassword.tsx';
import { getGlobalStore } from '@/stores/global.ts';

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
    filter: () => {
      const { settings } = getGlobalStore();

      return settings.app.registrationEnabled && settings.app.passwordLoginEnabled;
    },
  },
  {
    path: '/forgot-password',
    element: ForgotPassword,
    filter: () => getGlobalStore().settings.app.passwordLoginEnabled,
  },
  {
    path: '/reset-password',
    element: ResetPassword,
  },
];

export default routes;
