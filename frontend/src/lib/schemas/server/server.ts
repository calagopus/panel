import { z } from 'zod';
import { adminServerFeatureLimitsSchema, adminServerLimitsSchema } from '@/lib/schemas/admin/servers.ts';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { eggConfigurationRouteItemSchema } from '../generic.ts';

export const serverStatus = z.enum(['installing', 'install_failed', 'restoring_backup']);

export const serverAutostartBehavior = z.enum(['always', 'unless_stopped', 'never']);

export const serverPowerState = z.enum(['offline', 'starting', 'stopping', 'running']);

export const serverPowerAction = z.enum(['start', 'stop', 'restart', 'kill']);

export const serverBackupStatus = z.enum(['starting', 'finished', 'failed']);

export const serverEggSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  startupCommands: z.record(z.string(), z.string()),
  separatePort: z.boolean(),
  features: z.array(z.string()),
  dockerImages: z.record(z.string(), z.string()),
  created: z.date(),
});

export const serverEggConfigurationSchema = z.object({
  allocationSelfAssignEnabled: z.boolean(),
  allocationSelfAssignRequirePrimary: z.boolean(),
  startupAllowCustomCommand: z.boolean(),
  routeOrder: z.array(eggConfigurationRouteItemSchema).nullable(),
});

export const serverSchema = z.object({
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
  limits: z.lazy(() => adminServerLimitsSchema),
  featureLimits: z.lazy(() => adminServerFeatureLimitsSchema),
  startup: z.string(),
  image: z.string(),
  autoKill: z.object({
    enabled: z.boolean(),
    seconds: z.number().int().nonnegative(),
  }),
  autoStartBehavior: z.lazy(() => serverAutostartBehavior),
  timezone: z.string().nullable(),
  created: z.coerce.date(),
});

export const serverImagePullProgressSchema = z.object({
  status: z.enum(['pulling', 'extracting']),
  bytes_processed: z.number(),
  bytes_total: z.number(),
});

export const serverResourceUsageSchema = z.object({
  memoryBytes: z.number(),
  memoryLimitBytes: z.number(),
  diskBytes: z.number(),
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
