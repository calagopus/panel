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

export const systemBackupPolicyRunTargetStatus = z.enum(['pending', 'dispatched', 'skipped', 'failed']);

export const systemBackupPolicyRunTargetReason = z.enum([
  'node_maintenance',
  'backup_configuration_maintenance',
  'database_agent_host_maintenance',
  'database_instance_stopped',
  'server_busy',
  'metadata_failed',
  'no_backup_configuration',
  'unsupported_backup_disk',
  'target_removed',
  'create_failed',
  'policy_disabled',
  'superseded',
  'cancelled',
]);

export const adminSystemBackupPolicyRunSchema = z.looseObject({
  uuid: z.string(),
  manual: z.boolean(),
  occurrence: z.coerce.date(),
  totalTargets: z.number(),
  pendingTargets: z.number(),
  runningTargets: z.number(),
  successfulTargets: z.number(),
  failedTargets: z.number(),
  skippedTargets: z.number(),
  cancelled: z.coerce.date().nullable(),
  completed: z.coerce.date().nullable(),
  created: z.coerce.date(),
});

export const adminSystemBackupPolicyLatestRunsSchema = z.record(z.string(), adminSystemBackupPolicyRunSchema);

export const adminSystemBackupPolicyRunTargetSchema = z.looseObject({
  uuid: z.string(),
  server: z.lazy(() => adminServerSchema).nullable(),
  databaseInstanceUuid: z.string().nullable(),
  databaseInstanceName: z.string().nullable(),
  serverBackupUuid: z.string().nullable(),
  serverBackupSuccessful: z.boolean().nullable(),
  serverBackupCompleted: z.coerce.date().nullable(),
  status: systemBackupPolicyRunTargetStatus,
  reason: systemBackupPolicyRunTargetReason.nullable(),
  notBefore: z.coerce.date().nullable(),
  updated: z.coerce.date(),
});
