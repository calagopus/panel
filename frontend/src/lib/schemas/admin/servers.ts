import { z } from 'zod';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { databaseType } from '@/lib/schemas/generic.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { serverAutostartBehavior, serverStatus } from '@/lib/schemas/server/server.ts';
import { nullableNumber, nullableString } from '@/lib/transformers.ts';

export const adminServerLimitsSchema = z.object({
  cpu: z.number().min(0),
  memory: z.number().min(0),
  memoryOverhead: z.number().min(0),
  swap: z.number().min(-1),
  disk: z.number().min(0),
  ioWeight: z.preprocess(nullableNumber, z.number().min(0).max(1000).nullable()),
});

export const adminServerFeatureLimitsSchema = z.object({
  allocations: z.number().min(0),
  databases: z.number().min(0),
  backups: z.number().min(0),
  schedules: z.number().min(0),
});

export const adminServerSchema = z.object({
  uuid: z.string(),
  uuidShort: z.string(),
  externalId: z.preprocess(nullableString, z.string().max(255).nullable()),
  allocation: z.lazy(() => serverAllocationSchema).nullable(),
  node: z.lazy(() => adminNodeSchema),
  owner: z.lazy(() => adminFullUserSchema),
  egg: z.lazy(() => adminEggSchema),
  backupConfiguration: z.lazy(() => adminBackupConfigurationSchema).nullable(),
  nest: z.lazy(() => adminNestSchema),
  status: z.lazy(() => serverStatus).nullable(),
  isSuspended: z.boolean(),
  isTransferring: z.boolean(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  limits: z.lazy(() => adminServerLimitsSchema),
  pinnedCpus: z.array(z.number()),
  featureLimits: z.lazy(() => adminServerFeatureLimitsSchema),
  startup: z.string().min(1).max(8192),
  image: z.string().min(2).max(255),
  autoKill: z.object({
    enabled: z.boolean(),
    seconds: z.number(),
  }),
  autoStartBehavior: z.lazy(() => serverAutostartBehavior),
  timezone: z.preprocess(nullableString, z.string().nullable()),
  hugepagesPassthroughEnabled: z.boolean(),
  kvmPassthroughEnabled: z.boolean(),
  created: z.date(),
});

const adminServerBaseOmit = adminServerSchema.omit({
  uuid: true,
  uuidShort: true,
  allocation: true,
  node: true,
  owner: true,
  egg: true,
  backupConfiguration: true,
  nest: true,
  status: true,
  isSuspended: true,
  isTransferring: true,
  autoKill: true,
  autoStartBehavior: true,
  created: true,
});

export const adminServerCreateSchema = z.lazy(() =>
  adminServerBaseOmit.extend({
    startOnCompletion: z.boolean(),
    skipInstaller: z.boolean(),
    nodeUuid: z.uuid(),
    ownerUuid: z.uuid(),
    eggUuid: z.uuid(),
    backupConfigurationUuid: z.uuid().nullable(),
    allocationUuid: z.uuid().nullable(),
    allocationUuids: z.array(z.uuid()),
    variables: z.array(
      z.object({
        envVariable: z.string().min(1).max(255),
        value: z.string().max(4096),
      }),
    ),
  }),
);

export const adminServerUpdateSchema = z.lazy(() =>
  adminServerBaseOmit.extend({
    ownerUuid: z.uuid(),
    eggUuid: z.uuid(),
    backupConfigurationUuid: z.uuid().nullable(),
  }),
);

export const adminServerBackupSchema = z.object({
  uuid: z.string(),
  server: z.lazy(() => adminServerSchema).nullable(),
  name: z.string(),
  ignoredFiles: z.array(z.string()),
  isSuccessful: z.boolean(),
  isLocked: z.boolean(),
  isBrowsable: z.boolean(),
  isStreaming: z.boolean(),
  isRemote: z.boolean(),
  checksum: z.string().nullable(),
  bytes: z.number(),
  files: z.number(),
  completed: z.date().nullable(),
  created: z.date(),
});

export const adminServerDatabaseSchema = z.object({
  uuid: z.string(),
  server: z.lazy(() => adminServerSchema),
  name: z.string(),
  isLocked: z.boolean(),
  username: z.string(),
  password: z.string(),
  host: z.string(),
  port: z.number(),
  type: databaseType,
  created: z.date(),
});

export const adminServerMountSchema = z.object({
  mount: z.lazy(() => adminMountSchema),
  created: z.date(),
});
