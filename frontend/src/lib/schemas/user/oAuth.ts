import { z } from 'zod';
import { oAuthProviderSchema } from '@/lib/schemas/generic.ts';

export const userOAuthLinkSchema = z.object({
  uuid: z.string(),
  oauthProvider: oAuthProviderSchema,
  identifier: z.string(),
  lastUsed: z.coerce.date().nullable(),
  created: z.coerce.date(),
});
