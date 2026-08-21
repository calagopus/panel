import { z } from 'zod';
import { databaseAgentType } from '@/lib/schemas/generic.ts';
import { nullableString } from '@/lib/transformers.ts';

export const serverDatabaseInstanceSchema = z.looseObject({
  uuid: z.string(),
  updateAvailable: z.boolean(),
  type: z.lazy(() => databaseAgentType),
  host: z.string().nullable(),
  port: z.number().nullable(),
  name: z.string(),
  isLocked: z.boolean(),
  memory: z.number(),
  swap: z.number(),
  disk: z.number(),
  ioWeight: z.number().nullable(),
  cpu: z.number(),
  created: z.coerce.date(),
});

export const serverDatabaseInstancePowerStateSchema = z.enum(['offline', 'starting', 'stopping', 'running']);

export const serverDatabaseInstancePowerAction = z.enum(['start', 'stop', 'restart', 'kill']);

export const serverDatabaseInstanceResourceUsageSchema = z.object({
  memoryBytes: z.number(),
  memoryLimitBytes: z.number(),
  diskBytes: z.number(),
  state: serverDatabaseInstancePowerStateSchema,
  cpuAbsolute: z.number(),
  uptime: z.number(),
});

export const serverDatabaseInstanceImagePullProgressSchema = z.object({
  status: z.enum(['pulling', 'extracting']),
  bytesProcessed: z.number(),
  bytesTotal: z.number(),
});

export const serverDatabaseInstanceWebsocketMessageSchema = z.object({
  event: z.string(),
  args: z.array(z.string()).default([]),
});

export const serverDatabaseInstanceOperationRemoteImportSchema = z.object({
  type: z.literal('remote_import'),
  sourceHost: z.string(),
  sourceDb: z.string().nullable(),
  db: z.string().nullable(),
  wipe: z.boolean(),
  startTime: z.coerce.date(),
  bytesProcessed: z.number(),
});

export const serverDatabaseInstanceOperationSchema = z.discriminatedUnion('type', [
  serverDatabaseInstanceOperationRemoteImportSchema,
]);

export const serverDatabaseInstanceDatabaseSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  created: z.coerce.date(),
});

export const serverDatabaseInstanceUserPermission = z.enum(['none', 'read_only', 'read_write']);

export const serverDatabaseInstanceUserDatabaseSchema = z.object({
  databaseUuid: z.string(),
  permission: serverDatabaseInstanceUserPermission,
  created: z.coerce.date(),
});

export const serverDatabaseInstanceUserSchema = z.object({
  uuid: z.string(),
  username: z.string(),
  password: z.string(),
  databases: z.array(serverDatabaseInstanceUserDatabaseSchema),
});

export const serverDatabaseInstanceTemplateSchema = z.looseObject({
  uuid: z.string(),
  version: z.number(),
  name: z.string(),
  description: z.preprocess(nullableString, z.string().nullable()),
  type: z.lazy(() => databaseAgentType),
  dockerImages: z.record(z.string(), z.string()),
  memory: z.number(),
  swap: z.number(),
  disk: z.number(),
  ioWeight: z.number().nullable(),
  cpu: z.number(),
  created: z.coerce.date(),
});

export const serverDatabaseInstanceCreateSchema = z.object({
  templateUuid: z.uuid(),
  name: z.string().min(1).max(31),
  image: z.string().min(1),
});

export const serverDatabaseInstanceEditSchema = z.object({
  name: z.string().min(1).max(31),
  locked: z.boolean(),
});

export const serverDatabaseInstanceDatabaseCreateSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(23)
    .regex(/^[a-zA-Z0-9]+$/),
});

export const serverDatabaseInstanceRemoteImportSchema = z.object({
  url: z.url().max(2048),
  sourceDb: z.preprocess(nullableString, z.string().nullable()),
  wipe: z.boolean(),
});

export const serverDatabaseInstanceUserDatabaseGrantSchema = z.object({
  databaseUuid: z.string(),
  permission: serverDatabaseInstanceUserPermission,
});

export const serverDatabaseInstanceUserCreateSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(23)
    .regex(/^[a-zA-Z0-9]+$/),
  databases: z.array(serverDatabaseInstanceUserDatabaseGrantSchema),
});

export const serverDatabaseInstanceUserDatabasesUpdateSchema = z.object({
  databases: z.array(serverDatabaseInstanceUserDatabaseGrantSchema),
});
