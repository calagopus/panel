import { z } from 'zod';

export const userSecurityKeySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  credentialId: z.string(),
  lastUsed: z.coerce.date().nullable(),
  created: z.coerce.date(),
});
