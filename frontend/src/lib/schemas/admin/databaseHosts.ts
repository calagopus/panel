import { z } from 'zod';
import { nullableNumber, nullableString } from '@/lib/transformers.ts';

export const adminDatabaseHostSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  username: z.string().min(3).max(255),
  password: z.string().min(1).max(512),
  host: z.string().min(3).max(255),
  port: z.number().min(0).max(65535),
  deploymentEnabled: z.boolean(),
  maintenanceEnabled: z.boolean(),
  publicHost: z.preprocess(nullableString, z.string().max(255).nullable()),
  publicPort: z.preprocess(nullableNumber, z.number().min(0).max(65535).nullable()),
  type: z.enum(['mysql', 'postgres']),
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
    .extend({
      password: z.preprocess(nullableString, adminDatabaseHostSchema.shape.password.nullable()),
    }),
);
