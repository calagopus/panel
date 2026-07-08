import { z } from 'zod';
import { nullableString } from '@/lib/transformers.ts';

export const adminDatabaseAgentHostSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().min(1).max(1024).nullable()),
  deploymentEnabled: z.boolean(),
  maintenanceEnabled: z.boolean(),
  url: z.url().min(3).max(255),
  memory: z.number().min(1),
  disk: z.number().min(1),
  created: z.date(),
});

export const adminDatabaseAgentHostCreateSchema = z.lazy(() =>
  adminDatabaseAgentHostSchema.omit({
    uuid: true,
    created: true,
  }),
);

export const adminDatabaseAgentHostUpdateSchema = z.lazy(() =>
  adminDatabaseAgentHostSchema
    .omit({
      uuid: true,
      created: true,
    })
    .partial(),
);
