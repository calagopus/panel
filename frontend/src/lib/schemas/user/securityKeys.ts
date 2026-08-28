import { z } from 'zod';

export const userSecurityKeyCreateSchema = z.object({
  name: z.string().min(3).max(31),
  allowUsernamelessLogin: z.boolean(),
  password: z.string().max(512),
});

export const userSecurityKeyDeleteSchema = z.object({
  password: z.string().max(512),
});

export const userSecurityKeySchema = z.looseObject({
  uuid: z.string(),
  name: z.string(),
  credentialId: z.string(),
  lastUsed: z.coerce.date().nullable(),
  created: z.coerce.date(),
});
