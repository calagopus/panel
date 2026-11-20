import { z } from 'zod';
import { nullableString } from '@/lib/serialization/transformers.ts';

export const serverSettingsReinstallSchema = z.object({
  truncateDirectory: z.boolean(),
  startOnCompletion: z.boolean(),
});

export const serverSettingsAutokillSchema = z.object({
  enabled: z.boolean(),
  seconds: z.number().min(1).max(3600),
});

export const serverSettingsAutostartSchema = z.object({
  behavior: z.enum(['always', 'unless_stopped', 'never']),
});

export const serverSettingsRenameSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
});

export const serverSettingsTimezoneSchema = z.object({
  timezone: z.preprocess((value) => (value === '' ? null : value), z.string().min(3).max(255).nullable()),
});

export const serverSettingsTimezoneDefaultSchema = z.object({
  defaultTimezone: z.string().nullable(),
});

export const serverTrashSettingsSchema = z.object({
  retention: z.number().int().min(0).max(31536000),
  usageThreshold: z.number().int().min(0).max(100),
});

export const serverSettingsTrashSchema = z.object({
  custom: serverTrashSettingsSchema.nullable(),
});
