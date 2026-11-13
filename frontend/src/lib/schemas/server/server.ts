import { z } from 'zod';
import { adminServerFeatureLimitsSchema } from '@/lib/schemas/admin/servers.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { serverTrashSettingsSchema } from '@/lib/schemas/server/settings.ts';
import { eggConfigurationRouteItemSchema } from '../generic.ts';

export const serverStatus = z.enum(['installing', 'install_failed', 'restoring_backup', 'backup_restore_failed']);

export const serverAutostartBehavior = z.enum(['always', 'unless_stopped', 'never']);

export const serverPowerState = z.enum(['offline', 'starting', 'stopping', 'running']);

export const serverPowerAction = z.enum(['start', 'stop', 'restart', 'kill']);

export const serverBackupStatus = z.enum(['starting', 'finished', 'failed']);

export const serverLimitsSchema = z.object({
  cpu: z.number().min(0),
  memory: z.number().min(0),
  swap: z.number().min(-1),
  disk: z.number().min(0),
  bandwidth: z.object({ upload: z.number().min(0), download: z.number().min(0) }).default({ upload: 0, download: 0 }),
});

export const serverEggSchema = z.looseObject({
  uuid: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  startupCommands: z.record(z.string(), z.string()),
  separatePort: z.boolean(),
  features: z.array(z.string()),
  dockerImages: z.record(z.string(), z.string()),
  created: z.coerce.date(),
});

export const serverEggConfigurationSchema = z.looseObject({
  allocationSelfAssignEnabled: z.boolean(),
  allocationSelfAssignRequirePrimary: z.boolean(),
  startupAllowCustomCommand: z.boolean(),
  firewallEnabled: z.boolean(),
  privateNetworkEnabled: z.boolean(),
  routeOrder: z.array(eggConfigurationRouteItemSchema).nullable(),
});

export const serverSchema = z.looseObject({
  uuid: z.string(),
  uuidShort: z.string(),
  allocation: z.lazy(() => serverAllocationSchema).nullable(),
  egg: z.lazy(() => serverEggSchema),
  eggConfiguration: z.lazy(() => serverEggConfigurationSchema).nullable(),
  status: serverStatus.nullable(),
  isSuspended: z.boolean(),
  isOwner: z.boolean(),
  isTransferring: z.boolean(),
  permissions: z.array(z.string()),
  ignoredFiles: z.array(z.string()),
  locationUuid: z.string(),
  locationName: z.string(),
  locationFlag: z.string().nullable(),
  nodeUuid: z.string(),
  nodeName: z.string(),
  nodeMaintenanceEnabled: z.boolean(),
  sftpHost: z.string(),
  sftpPort: z.number().int().min(1).max(65535),
  name: z.string(),
  description: z.string().nullable(),
  limits: z.lazy(() => serverLimitsSchema),
  featureLimits: z.lazy(() => adminServerFeatureLimitsSchema),
  startup: z.string(),
  image: z.string(),
  autoKill: z.object({
    enabled: z.boolean(),
    seconds: z.number().int().nonnegative(),
  }),
  autoStartBehavior: z.lazy(() => serverAutostartBehavior),
  timezone: z.string().nullable(),
  trash: z.object({
    retention: z.number().int().nonnegative().nullable(),
    usageThreshold: z.number().int().nonnegative().nullable(),
    custom: z.boolean(),
    defaults: serverTrashSettingsSchema,
  }),
  created: z.coerce.date(),
});

export const serverImagePullProgressSchema = z.object({
  status: z.enum(['pulling', 'extracting']),
  bytes_processed: z.number(),
  bytes_total: z.number(),
});

export const serverInstallProgressSchema = z.object({
  progress: z.number(),
  total: z.number(),
  label: z.string().nullish(),
});

export const serverResourceUsageSchema = z.object({
  memoryBytes: z.number(),
  memoryLimitBytes: z.number(),
  diskBytes: z.number(),
  trashBytes: z.number().optional(),
  state: z.lazy(() => serverPowerState),
  network: z.object({
    rxBytes: z.number(),
    rxPackets: z.number(),
    txBytes: z.number(),
    txPackets: z.number(),
  }),
  cpuAbsolute: z.number(),
  cpuLimitAbsolute: z.number(),
  uptime: z.number(),
});

export const serverResourceHistoryStatesSchema = z.object({
  offline: z.number(),
  starting: z.number(),
  stopping: z.number(),
  running: z.number(),
});

export const serverResourceHistoryPointSchema = z.object({
  start: z.coerce.date(),
  states: serverResourceHistoryStatesSchema.nullable(),
  sampledSeconds: z.number().nullable(),
  cpuAverage: z.number().nullable(),
  cpuMax: z.number().nullable(),
  memoryAverageBytes: z.number().nullable(),
  memoryMaxBytes: z.number().nullable(),
  diskBytes: z.number().nullable(),
  networkRxBytes: z.number().nullable(),
  networkTxBytes: z.number().nullable(),
});

export const serverResourceHistoryLimitsSchema = z.object({
  since: z.coerce.date(),
  memoryLimitBytes: z.number(),
  cpuLimit: z.number(),
});

export const serverResourceHistorySchema = z.object({
  resolution: z.number(),
  points: z.array(serverResourceHistoryPointSchema),
  limits: z.array(serverResourceHistoryLimitsSchema),
});

export const serverCrashSchema = z.object({
  id: z.number(),
  timestamp: z.coerce.date(),
  exitCode: z.number(),
  oomKilled: z.boolean(),
  lines: z.number(),
  bytes: z.number(),
  truncated: z.boolean(),
});
