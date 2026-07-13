import { z } from 'zod';
import { userSchema } from '@/lib/schemas/user.ts';

export const activitySchema = z.object({
  user: userSchema.nullable(),
  impersonator: userSchema.nullable(),
  event: z.string(),
  ip: z.string().nullable(),
  data: z.object().nullable(),
  isApi: z.boolean(),
  created: z.coerce.date(),
});
