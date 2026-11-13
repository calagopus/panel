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

export interface TwoFactorAvailability {
  webauthnEnabled: boolean;
  emailTwoFactorEnabled: boolean;
  mailConfigured?: boolean;
}

export function isTwoFactorMethodAvailable(
  method: z.infer<typeof twoFactorMethod>,
  availability: TwoFactorAvailability,
): boolean {
  switch (method) {
    case 'totp':
      return true;
    case 'security_key':
      return availability.webauthnEnabled;
    case 'email':
      return availability.emailTwoFactorEnabled && availability.mailConfigured !== false;
  }
}

export function hasAvailableTwoFactorMethod(
  acceptedMethods: z.infer<typeof twoFactorMethod>[],
  availability: TwoFactorAvailability,
): boolean {
  return acceptedMethods.some((method) => isTwoFactorMethodAvailable(method, availability));
}
