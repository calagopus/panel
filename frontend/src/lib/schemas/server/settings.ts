import { z } from 'zod';
import { nullableString } from '@/lib/serialization/transformers.ts';

export const serverSettingsReinstallSchema = z.object({
  truncateDirectory: z.boolean(),
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
