import { z } from 'zod';
import { nullableNumber, nullableString } from '@/lib/transformers.ts';
import { databaseType } from '../generic.ts';

export const adminDatabaseCredentialsConnectionStringSchema = z.object({
  type: z.literal('connection_string'),
  connectionString: z.url().min(1).max(255),
});

export const adminDatabaseCredentialsDetailsSchema = z.object({
  type: z.literal('details'),
  username: z.string().min(3).max(255),
  password: z.string().min(1).max(255),
  host: z.string().min(3).max(255),
  port: z.number().min(1).max(65535),
});

export const adminDatabaseCredentialsSchema = z.discriminatedUnion('type', [
  adminDatabaseCredentialsConnectionStringSchema,
  adminDatabaseCredentialsDetailsSchema,
]);

export const adminDatabaseHostSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  type: z.lazy(() => databaseType),
  deploymentEnabled: z.boolean(),
  maintenanceEnabled: z.boolean(),
  publicHost: z.preprocess(nullableString, z.string().max(255).nullable()),
  publicPort: z.preprocess(nullableNumber, z.number().min(1).max(65535).nullable()),
  credentials: adminDatabaseCredentialsSchema,
  created: z.date(),
});

export const adminDatabaseHostCreateSchema = z.lazy(() =>
  adminDatabaseHostSchema.omit({
    uuid: true,
    created: true,
  }),
);

export const adminDatabaseHostUpdateSchema = z.lazy(() =>
  adminDatabaseHostSchema
    .omit({
      uuid: true,
      created: true,
    })
    .partial(),
);
