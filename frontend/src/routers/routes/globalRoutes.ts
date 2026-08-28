import type { GlobalRouteDefinition } from 'shared';
import VerifyEmail from '@/pages/auth/VerifyEmail.tsx';

const routes: GlobalRouteDefinition[] = [
  {
    path: '/auth/verify-email',
    element: VerifyEmail,
  },
];

export default routes;
