import { z } from 'zod';

export const serverVariableSchema = z.object({
  name: z.string(),
  nameTranslations: z.record(z.string(), z.string()),
  description: z.string().nullable(),
  descriptionTranslations: z.record(z.string(), z.string()),
  envVariable: z.string(),
  defaultValue: z.string().nullable(),
  value: z.string(),
  isEditable: z.boolean(),
  isSecret: z.boolean(),
  rules: z.array(z.string()),
  created: z.date(),
});

export const serverEnvVariableSchema = z.object({
  envVariable: z.string(),
  value: z.string(),
});
