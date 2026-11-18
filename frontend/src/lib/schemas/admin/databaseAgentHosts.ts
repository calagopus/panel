import { z } from 'zod';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { nullableNumber, nullableString } from '@/lib/serialization/transformers.ts';
import { hostnameSchema } from '../generic.ts';

export const adminDatabaseAgentHostTypeSettingsSchema = z.object({
  enabled: z.boolean(),
  publicHost: z.preprocess(nullableString, hostnameSchema.nullable()),
  publicPort: z.preprocess(nullableNumber, z.number().min(1).max(65535).nullable()),
});

export const adminDatabaseAgentHostSchema = z.looseObject({
  uuid: z.string(),
  backupConfiguration: z.lazy(() => adminBackupConfigurationSchema).nullable(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().min(1).max(1024).nullable()),
  deploymentEnabled: z.boolean(),
  maintenanceEnabled: z.boolean(),
  url: z.url().min(3).max(255),
  memory: z.number().min(0),
  disk: z.number().min(0),
  types: z.object({
    postgres: adminDatabaseAgentHostTypeSettingsSchema,
    mariadb: adminDatabaseAgentHostTypeSettingsSchema,
    mongodb: adminDatabaseAgentHostTypeSettingsSchema,
    redis: adminDatabaseAgentHostTypeSettingsSchema,
    clickhouse: adminDatabaseAgentHostTypeSettingsSchema,
  }),
  created: z.coerce.date(),
});

export const adminDatabaseAgentHostAllocatedCapacitySchema = z.object({
  instances: z.number(),
  cpu: z.number(),
  memory: z.number(),
  disk: z.number(),
});

export const adminDatabaseAgentHostCapacitySchema = z.object({
  limits: z.object({
    memory: z.number(),
    disk: z.number(),
  }),
  allocated: adminDatabaseAgentHostAllocatedCapacitySchema,
  instances: z.array(
    z.object({
      uuid: z.string(),
      name: z.string(),
      serverUuid: z.string(),
      serverName: z.string(),
      cpu: z.number(),
      memory: z.number(),
      disk: z.number(),
    }),
  ),
});

export const adminDatabaseAgentHostCapacitiesSchema = z.record(
  z.string(),
  adminDatabaseAgentHostAllocatedCapacitySchema,
);

export const adminDatabaseAgentHostCreateSchema = z.lazy(() =>
  adminDatabaseAgentHostSchema
    .omit({
      uuid: true,
      backupConfiguration: true,
      created: true,
    })
    .extend({
      backupConfigurationUuid: z.uuid().nullable(),
    }),
);

export const adminDatabaseAgentHostUpdateSchema = z.lazy(() =>
  adminDatabaseAgentHostSchema
    .omit({
      uuid: true,
      backupConfiguration: true,
      created: true,
    })
    .extend({
      backupConfigurationUuid: z.uuid().nullable(),
    })
    .partial(),
);

export const adminDatabaseAgentHostInstanceUpdateSchema = z.object({
  image: z.string().min(1).max(255).nullable(),
  env: z.record(z.string(), z.string()).nullable(),
  memory: z.number().min(0).nullable(),
  swap: z.number().min(-1).nullable(),
  disk: z.number().min(0).nullable(),
  ioWeight: z.number().min(0).max(1000).nullable(),
  cpu: z.number().min(0).nullable(),
});
