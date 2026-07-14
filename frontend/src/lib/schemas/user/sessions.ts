import { z } from 'zod';

export const userSessionSchema = z.looseObject({
  uuid: z.string(),
  ip: z.string(),
  userAgent: z.string(),
  isUsing: z.boolean(),
  lastUsed: z.coerce.date(),
  created: z.coerce.date(),
});
