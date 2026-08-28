import { z } from 'zod';
import { nullableString } from '@/lib/transformers.ts';

export const userToastPosition = z.enum([
  'top_left',
  'top_center',
  'top_right',
  'bottom_left',
  'bottom_center',
  'bottom_right',
]);

export const roleSchema = z.looseObject({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  requireTwoFactor: z.boolean(),
  adminPermissions: z.array(z.string()),
  serverPermissions: z.array(z.string()),
  created: z.coerce.date(),
});

export const userSchema = z.looseObject({
  uuid: z.string(),
  username: z.string(),
  avatar: z.string().nullable(),
  totpEnabled: z.boolean(),
  created: z.coerce.date(),
});

export const twoFactorMethod = z.enum(['totp', 'security_key', 'email']);

export const fullUserSchema = z.lazy(() =>
  userSchema.extend({
    email: z.string(),
    nameFirst: z.string().nullable(),
    nameLast: z.string().nullable(),
    role: roleSchema.nullable(),
    avatar: z.string().nullable(),
    totpEnabled: z.boolean(),
    totpLastUsed: z.coerce.date().nullable(),
    emailTwoFactorEnabled: z.boolean(),
    twoFactorMethods: z.array(twoFactorMethod),
    requireTwoFactor: z.boolean(),
    twoFactorSatisfied: z.boolean(),
    emailVerified: z.boolean(),
    requireEmailVerification: z.boolean(),
    passwordLoginDisabled: z.boolean(),
    hasPassword: z.boolean(),
    admin: z.boolean(),
    frozen: z.boolean(),
    suspended: z.boolean(),
    language: z.string(),
  }),
);

export const userServerGroupSchema = z.looseObject({
  uuid: z.string(),
  name: z.string(),
  order: z.number(),
  serverOrder: z.array(z.string()),
  created: z.coerce.date(),
});
