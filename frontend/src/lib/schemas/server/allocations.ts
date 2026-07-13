import { z } from 'zod';
import { nullableString } from '@/lib/transformers.ts';

export const serverAllocationSchema = z.object({
  uuid: z.string(),
  ip: z.string(),
  ipAlias: z.string().nullable(),
  port: z.number(),
  notes: z.string().nullable(),
  isPrimary: z.boolean(),
  created: z.coerce.date(),
});

export const serverAllocationsEditSchema = z.object({
  notes: z.preprocess(nullableString, z.string().max(1024).nullable()),
});
