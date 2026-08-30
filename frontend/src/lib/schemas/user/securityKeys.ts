import { z } from 'zod';

export const userSecurityKeyDeleteSchema = z.object({
  password: z.string().max(512),
});

export const userSecurityKeySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  credentialId: z.string(),
  lastUsed: z.date().nullable(),
  created: z.date(),
});
