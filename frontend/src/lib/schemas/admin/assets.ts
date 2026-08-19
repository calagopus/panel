import { z } from 'zod';

export const storageAssetSchema = z.object({
  name: z.string(),
  url: z.string(),
  size: z.number(),
  isDirectory: z.boolean(),
  created: z.coerce.date(),
});

export const assetDirectoryCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((val) => !val.includes('..') && !val.includes('/') && !val.includes('\\')),
});
