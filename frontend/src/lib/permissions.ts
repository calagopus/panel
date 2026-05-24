import { z } from 'zod';
import { fullUserSchema } from '@/lib/schemas/user.ts';

export const isAdmin = (user: z.infer<typeof fullUserSchema> | null, permission?: string) => {
  return (
    user?.admin ||
    (permission
      ? (user?.role?.adminPermissions || []).includes(permission)
      : (user?.role?.adminPermissions || []).length > 0)
  );
};
