import { z } from 'zod';

export const serverMountSchema = z.looseObject({
  uuid: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  readOnly: z.boolean(),
  target: z.string(),
  created: z.coerce.date().nullable(),
});
