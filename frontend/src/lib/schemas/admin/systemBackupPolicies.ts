import { z } from 'zod';
import { backupRetentionSchema } from '@/lib/schemas/backupRetention.ts';
import { serverBackupKind } from '@/lib/schemas/server/backups.ts';
import { nullableString } from '@/lib/serialization/transformers.ts';
import { isValidCronExpression } from '../server/schedules.ts';
import { adminBackupConfigurationSchema } from './backupConfigurations.ts';
import { adminDatabaseAgentHostSchema } from './databaseAgentHosts.ts';
import { adminLocationSchema } from './locations.ts';
import { adminNodeSchema } from './nodes.ts';
import { adminServerSchema } from './servers.ts';

export const adminSystemBackupPolicySchema = z.looseObject({
  uuid: z.string(),
  backupConfiguration: z.lazy(() => adminBackupConfigurationSchema).nullable(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  enabled: z.boolean(),
  kind: serverBackupKind,
  cron: z.string().min(1),
  retention: backupRetentionSchema,
  parallelism: z.number().min(1).max(100),
  triggered: z.coerce.date().nullable(),
  totalNodes: z.number(),
  totalDatabaseAgentHosts: z.number(),
  totalLocations: z.number(),
  totalServers: z.number(),
  totalBackups: z.number(),
  created: z.coerce.date(),
});

export const adminSystemBackupPolicyUpdateSchema = z.lazy(() =>
  adminSystemBackupPolicySchema
    .omit({
      uuid: true,
      backupConfiguration: true,
      triggered: true,
      totalNodes: true,
      totalDatabaseAgentHosts: true,
      totalLocations: true,
      totalServers: true,
      totalBackups: true,
      created: true,
    })
    .extend({
      backupConfigurationUuid: z.uuid().nullable(),
      cron: z.string().refine(isValidCronExpression, { message: 'Invalid cron expression' }),
    }),
);

export const adminSystemBackupPolicyNodeSchema = z.looseObject({
  node: z.lazy(() => adminNodeSchema),
  created: z.coerce.date(),
});

export const adminSystemBackupPolicyDatabaseAgentHostSchema = z.looseObject({
  databaseAgentHost: z.lazy(() => adminDatabaseAgentHostSchema),
  created: z.coerce.date(),
});

export const adminSystemBackupPolicyLocationSchema = z.looseObject({
  location: z.lazy(() => adminLocationSchema),
  created: z.coerce.date(),
});

export const adminSystemBackupPolicyServerSchema = z.looseObject({
  server: z.lazy(() => adminServerSchema),
  created: z.coerce.date(),
});
