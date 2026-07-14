import { z } from 'zod';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { nullableString } from '@/lib/transformers.ts';
import { adminDatabaseAgentHostSchema } from './databaseAgentHosts.ts';
import { adminDatabaseHostSchema } from './databaseHosts.ts';

export const adminLocationSchema = z.looseObject({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  flag: z.preprocess(nullableString, z.string().lowercase().length(2).nullable()),
  backupConfiguration: z.lazy(() => adminBackupConfigurationSchema).nullable(),
  created: z.string(),
});

export const adminLocationUpdateSchema = z.lazy(() =>
  adminLocationSchema
    .omit({
      uuid: true,
      backupConfiguration: true,
      created: true,
    })
    .extend({
      backupConfigurationUuid: z.uuid().nullable(),
    }),
);

export const adminLocationDatabaseHostSchema = z.looseObject({
  databaseHost: z.lazy(() => adminDatabaseHostSchema),
  created: z.coerce.date(),
});

export const adminLocationDatabaseAgentHostSchema = z.looseObject({
  databaseAgentHost: z.lazy(() => adminDatabaseAgentHostSchema),
  created: z.coerce.date(),
});
