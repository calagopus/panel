import { z } from 'zod';

export const storageAssetSchema = z.object({
  name: z.string(),
  url: z.string(),
  size: z.number(),
  isDirectory: z.boolean(),
  created: z.date(),
});

export const assetDirectoryCreateSchema = z.object({
  name: z.string().min(1).max(255),
});
