import { z } from 'zod';
import { fullUserSchema, twoFactorMethod } from '@/lib/schemas/user.ts';

export function withTwoFactorMethod(
  user: z.infer<typeof fullUserSchema>,
  acceptedMethods: z.infer<typeof twoFactorMethod>[],
  method: z.infer<typeof twoFactorMethod>,
  present: boolean,
): z.infer<typeof fullUserSchema> {
  const twoFactorMethods = present
    ? user.twoFactorMethods.includes(method)
      ? user.twoFactorMethods
      : [...user.twoFactorMethods, method]
    : user.twoFactorMethods.filter((m) => m !== method);

  return {
    ...user,
    twoFactorMethods,
    twoFactorSatisfied: acceptedMethods.some((m) => twoFactorMethods.includes(m)),
  };
}
