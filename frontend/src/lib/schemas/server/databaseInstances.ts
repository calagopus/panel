import { z } from 'zod';
import { databaseAgentType } from '@/lib/schemas/generic.ts';
import { nullableString } from '@/lib/transformers.ts';

export const serverDatabaseInstanceSchema = z.looseObject({
  uuid: z.string(),
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

export const serverDatabaseInstanceDatabaseSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  created: z.coerce.date(),
});

export const serverDatabaseInstanceUserSchema = z.object({
  uuid: z.string(),
  username: z.string(),
  password: z.string(),
  databaseUuid: z.preprocess(nullableString, z.string().nullable()),
});

export const serverDatabaseInstanceTemplateSchema = z.looseObject({
  uuid: z.string(),
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

export const serverDatabaseInstanceUserCreateSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(23)
    .regex(/^[a-zA-Z0-9]+$/),
  databaseUuid: z.string().nullable(),
});
