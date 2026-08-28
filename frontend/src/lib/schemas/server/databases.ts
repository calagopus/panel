import { z } from 'zod';
import { databaseType } from '@/lib/schemas/generic.ts';

export const serverDatabaseSchema = z.looseObject({
  uuid: z.string(),
  name: z.string(),
  isLocked: z.boolean(),
  username: z.string(),
  password: z.string().nullable(),
  host: z.string(),
  port: z.number(),
  type: z.lazy(() => databaseType),
  created: z.coerce.date(),
});

export const serverDatabaseCreateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(31)
    .regex(/^[a-zA-Z0-9_]+$/),
  databaseHostUuid: z.uuid(),
});

export const serverDatabaseEditSchema = z.object({
  locked: z.boolean(),
});

export const serverDatabaseQueryColumnSchema = z.object({
  name: z.string(),
  typeName: z.string(),
  binary: z.boolean(),
});

export const serverDatabaseQueryValueSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('null') }),
  z.object({ type: z.literal('text'), value: z.string(), truncated: z.boolean() }),
  z.object({ type: z.literal('binary'), value: z.string(), truncated: z.boolean() }),
]);

export const serverDatabaseQueryResultSchema = z.object({
  columns: z.array(serverDatabaseQueryColumnSchema),
  rows: z.array(z.array(serverDatabaseQueryValueSchema)),
  rowsAffected: z.number(),
  truncated: z.boolean(),
});

export const serverDatabaseSchemaColumnSchema = z.object({
  name: z.string(),
  typeName: z.string(),
  nullable: z.boolean(),
  default: z.string().nullable(),
  primaryKey: z.boolean(),
  autoIncrement: z.boolean(),
  generated: z.boolean(),
  binary: z.boolean(),
});

export const serverDatabaseSchemaTableSchema = z.object({
  schema: z.string().nullable(),
  name: z.string(),
  view: z.boolean(),
  rowEstimate: z.number().nullable(),
  columns: z.array(serverDatabaseSchemaColumnSchema),
});

export const serverDatabaseSchemaSchema = z.object({
  tables: z.array(serverDatabaseSchemaTableSchema),
  truncated: z.boolean(),
});

export const serverDatabaseFilterOperator = z.enum([
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'contains',
  'starts_with',
  'ends_with',
  'is_null',
  'not_null',
]);

export const serverDatabaseBrowseFilterSchema = z.object({
  column: z.string().min(1).max(255),
  operator: serverDatabaseFilterOperator,
  value: z.string().max(4096).nullable(),
});

export const serverDatabaseBrowseSchema = z.object({
  schema: z.string().nullable(),
  table: z.string(),
  orderBy: z.string().nullable(),
  descending: z.boolean(),
  limit: z.number().min(1).max(500),
  offset: z.number().min(0),
  filters: z.array(serverDatabaseBrowseFilterSchema).max(10),
});

export const serverDatabaseQuerySchema = z.object({
  query: z.string().min(1).max(65535),
  rows: z.number().min(1).max(1000),
  readOnly: z.boolean(),
});

export const serverDatabaseColumnDefinitionSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().min(1).max(64),
  nullable: z.boolean(),
  primaryKey: z.boolean(),
  autoIncrement: z.boolean(),
});

export const serverDatabaseTableCreateSchema = z.object({
  schema: z.string().nullable(),
  table: z.string().min(1).max(255),
  columns: z.array(serverDatabaseColumnDefinitionSchema).min(1).max(100),
});

export const serverDatabaseColumnCreateSchema = z.object({
  schema: z.string().nullable(),
  table: z.string(),
  column: serverDatabaseColumnDefinitionSchema,
});

export const serverDatabaseTableRenameSchema = z.object({
  schema: z.string().nullable(),
  table: z.string(),
  name: z.string().min(1).max(255),
});

export const serverDatabaseTableDeleteSchema = z.object({
  schema: z.string().nullable(),
  table: z.string(),
});

export const serverDatabaseColumnRenameSchema = z.object({
  schema: z.string().nullable(),
  table: z.string(),
  column: z.string(),
  name: z.string().min(1).max(255),
});

export const serverDatabaseColumnDeleteSchema = z.object({
  schema: z.string().nullable(),
  table: z.string(),
  column: z.string(),
});

export const serverDatabaseRowValueSchema = z.object({
  column: z.string(),
  value: z.string().nullable(),
});

export const serverDatabaseRowsInsertSchema = z.object({
  schema: z.string().nullable(),
  table: z.string(),
  rows: z
    .array(z.object({ values: z.array(serverDatabaseRowValueSchema) }))
    .min(1)
    .max(100),
});

export const serverDatabaseRowsUpdateSchema = z.object({
  schema: z.string().nullable(),
  table: z.string(),
  rows: z
    .array(
      z.object({
        keys: z.array(serverDatabaseRowValueSchema),
        values: z.array(serverDatabaseRowValueSchema),
      }),
    )
    .min(1)
    .max(100),
});

export const serverDatabaseRowsDeleteSchema = z.object({
  schema: z.string().nullable(),
  table: z.string(),
  rows: z
    .array(z.object({ keys: z.array(serverDatabaseRowValueSchema) }))
    .min(1)
    .max(100),
});
