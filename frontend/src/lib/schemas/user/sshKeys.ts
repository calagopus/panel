import { z } from 'zod';

export const userSshKeyProvider = z.enum(['github', 'gitlab', 'launchpad']);

export const userSshKeySchema = z.looseObject({
  uuid: z.string(),
  name: z.string(),
  fingerprint: z.string(),
  created: z.coerce.date(),
});
