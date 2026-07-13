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

export const roleSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  requireTwoFactor: z.boolean(),
  adminPermissions: z.array(z.string()),
  serverPermissions: z.array(z.string()),
  created: z.coerce.date(),
});

export const userSchema = z.object({
  uuid: z.string(),
  username: z.string(),
  avatar: z.string().nullable(),
  totpEnabled: z.boolean(),
  created: z.coerce.date(),
});

export const fullUserSchema = z.lazy(() =>
  userSchema.extend({
    email: z.string(),
    nameFirst: z.string(),
    nameLast: z.string(),
    role: roleSchema.nullable(),
    avatar: z.string().nullable(),
    totpEnabled: z.boolean(),
    totpLastUsed: z.coerce.date().nullable(),
    requireTwoFactor: z.boolean(),
    toastPosition: userToastPosition,
    startOnGroupedServers: z.boolean(),
    hasPassword: z.boolean(),
    admin: z.boolean(),
    frozen: z.boolean(),
    suspended: z.boolean(),
    language: z.string(),
  }),
);

export const userServerGroupSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  order: z.number(),
  serverOrder: z.array(z.string()),
  created: z.coerce.date(),
});
