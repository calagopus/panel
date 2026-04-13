import { z } from 'zod';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { nullableString } from '@/lib/transformers.ts';
import { adminDatabaseHostSchema } from './databaseHosts.ts';

export const adminLocationSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  backupConfiguration: z.lazy(() => adminBackupConfigurationSchema),
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

export const adminLocationDatabaseHostSchema = z.object({
  databaseHost: z.lazy(() => adminDatabaseHostSchema),
  created: z.date(),
});
