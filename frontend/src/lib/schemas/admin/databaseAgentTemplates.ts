import { z } from 'zod';
import { nullableNumber, nullableString } from '@/lib/transformers.ts';
import { databaseAgentType } from '../generic.ts';

export const adminDatabaseAgentTemplateSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().min(1).max(1024).nullable()),
  type: z.lazy(() => databaseAgentType),
  deploymentEnabled: z.boolean(),
  dockerImages: z.record(z.string(), z.string()),
  env: z.record(z.string(), z.string()),
  imageUid: z.number().min(0),
  imageGid: z.number().min(0),
  cmd: z.array(z.string()).nullable(),
  volumes: z.record(z.string(), z.string()),
  memory: z.number().min(0),
  swap: z.number().min(-1),
  disk: z.number().min(0),
  ioWeight: z.preprocess(nullableNumber, z.number().min(0).max(1000).nullable()),
  cpu: z.number().min(0),
  created: z.date(),
});

export const adminDatabaseAgentTemplateCreateSchema = z.lazy(() =>
  adminDatabaseAgentTemplateSchema.omit({
    uuid: true,
    created: true,
  }),
);

export const adminDatabaseAgentTemplateUpdateSchema = z.lazy(() =>
  adminDatabaseAgentTemplateSchema
    .omit({
      uuid: true,
      created: true,
    })
    .partial(),
);
