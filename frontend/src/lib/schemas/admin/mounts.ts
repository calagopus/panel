import { z } from 'zod';
import { nullableString } from '@/lib/transformers.ts';

export const adminMountSchema = z.looseObject({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  source: z.string().min(1).max(255),
  target: z.string().min(1).max(255),
  readOnly: z.boolean(),
  userMountable: z.boolean(),
  created: z.coerce.date(),
});

export const adminMountUpdateSchema = z.lazy(() =>
  adminMountSchema.omit({
    uuid: true,
    created: true,
  }),
);
