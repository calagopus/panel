import { z } from 'zod';
import { nullableString } from '@/lib/transformers.ts';

export const adminNestSchema = z.object({
  uuid: z.string(),
  author: z.string().min(2).max(255),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  created: z.coerce.date(),
});

export const adminNestUpdateSchema = z.lazy(() =>
  adminNestSchema.omit({
    uuid: true,
    created: true,
  }),
);
