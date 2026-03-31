import { z } from 'zod';
import { nullableString } from '@/lib/transformers.ts';

export const adminEggRepositorySchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  gitRepository: z.url({ protocol: /^https?$/ }),
  created: z.date(),
});

export const adminEggRepositoryUpdateSchema = z.lazy(() =>
  adminEggRepositorySchema.omit({
    uuid: true,
    created: true,
  }),
);

export const adminEggRepositoryEggSchema = z.object({
  uuid: z.string(),
  path: z.string(),
  author: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  exportedEgg: z.object({
    startup: z.string().min(1).max(4096),
    dockerImages: z.record(z.string(), z.string()),
  }),
});

export const adminEggEggRepositoryEggSchema = z.lazy(() =>
  adminEggRepositoryEggSchema.extend({
    eggRepository: z.lazy(() => adminEggRepositorySchema),
  }),
);
