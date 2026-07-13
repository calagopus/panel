import { z } from 'zod';
import { databaseType } from '@/lib/schemas/generic.ts';

export const serverDatabaseSchema = z.object({
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
