import { z } from 'zod';
import { databaseAgentType } from '@/lib/schemas/generic.ts';

export const serverBackupKind = z.enum(['server', 'database_instance']);

export const serverBackupSchema = z.looseObject({
  uuid: z.uuid(),
  backupGroupUuid: z.uuid().nullable(),
  databaseInstanceUuid: z.uuid().nullable(),
  databaseType: databaseAgentType.nullable(),
  kind: serverBackupKind,
  name: z.string(),
  ignoredFiles: z.array(z.string()),
  isSuccessful: z.boolean(),
  isLocked: z.boolean(),
  isBrowsable: z.boolean(),
  isStreaming: z.boolean(),
  checksum: z.string().nullable(),
  bytes: z.number(),
  files: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  deletionStatus: z.enum(['deleting', 'failed']).nullable(),
  completed: z.coerce.date().nullable(),
  created: z.coerce.date(),
});

export const serverBackupSourceInstanceSchema = z.object({
  uuid: z.uuid(),
  name: z.string(),
});

export const serverBackupFilterSchema = z.object({
  kind: serverBackupKind.optional(),
  databaseInstanceUuid: z.uuid().optional(),
  databaseType: databaseAgentType.optional(),
});

export const serverBackupCreateSchema = z.object({
  name: z.string().min(1).max(255),
  backupGroupUuid: z.uuid().nullable().optional(),
  databaseInstanceUuid: z.uuid().nullable().optional(),
  ignoredFiles: z.array(z.string()),
});

export const serverBackupEditSchema = z.object({
  name: z.string().min(1).max(255),
  locked: z.boolean(),
  backupGroupUuid: z.uuid().nullable(),
});

export const serverBackupRestoreSchema = z.object({
  truncateDirectory: z.boolean().optional(),
  restoreStartup: z.boolean().optional(),
  databaseInstanceUuid: z.uuid().optional(),
});

export const serverBackupUsageSchema = z.object({
  server: z.number(),
  databaseInstance: z.number(),
});

export const serverBackupGroupSchema = z.object({
  uuid: z.uuid(),
  name: z.string(),
  order: z.number(),
  retentionCount: z.number().nullable(),
  retentionDays: z.number().nullable(),
  totalBackups: z.number(),
  usableBackups: z.number(),
  usableUnlockedBackups: z.number(),
  created: z.coerce.date(),
});

export const serverBackupGroupCreateSchema = z.object({
  name: z.string().min(1).max(255),
  retentionCount: z.number().int().min(1).nullable(),
  retentionDays: z.number().int().min(1).nullable(),
});

export const serverBackupGroupUpdateSchema = serverBackupGroupCreateSchema;
