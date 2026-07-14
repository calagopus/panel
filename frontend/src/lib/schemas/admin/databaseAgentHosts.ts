import { z } from 'zod';
import { nullableNumber, nullableString } from '@/lib/transformers.ts';
import { hostnameSchema } from '../generic.ts';

export const adminDatabaseAgentHostTypeSettingsSchema = z.object({
  enabled: z.boolean(),
  publicHost: z.preprocess(nullableString, hostnameSchema.nullable()),
  publicPort: z.preprocess(nullableNumber, z.number().min(1).max(65535).nullable()),
});

export const adminDatabaseAgentHostSchema = z.looseObject({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().min(1).max(1024).nullable()),
  deploymentEnabled: z.boolean(),
  maintenanceEnabled: z.boolean(),
  url: z.url().min(3).max(255),
  memory: z.number().min(1),
  disk: z.number().min(1),
  types: z.object({
    postgres: adminDatabaseAgentHostTypeSettingsSchema,
    mariadb: adminDatabaseAgentHostTypeSettingsSchema,
    mongodb: adminDatabaseAgentHostTypeSettingsSchema,
    redis: adminDatabaseAgentHostTypeSettingsSchema,
  }),
  created: z.coerce.date(),
});

export const adminDatabaseAgentHostCapacitySchema = z.object({
  limits: z.object({
    memory: z.number(),
    disk: z.number(),
  }),
  allocated: z.object({
    instances: z.number(),
    cpu: z.number(),
    memory: z.number(),
    disk: z.number(),
  }),
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
