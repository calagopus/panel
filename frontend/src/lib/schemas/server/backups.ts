import { z } from 'zod';

export const serverBackupSchema = z.object({
  uuid: z.uuid(),
  name: z.string(),
  ignoredFiles: z.array(z.string()),
  isSuccessful: z.boolean(),
  isLocked: z.boolean(),
  isBrowsable: z.boolean(),
  isStreaming: z.boolean(),
  checksum: z.string().nullable(),
  bytes: z.number(),
  files: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  completed: z.date().nullable(),
  created: z.date(),
});

export const serverBackupWithProgressSchema = z.lazy(() =>
  serverBackupSchema.extend({
    progress: z
      .object({
        progress: z.number(),
        total: z.number(),
      })
      .optional(),
  }),
);

export const serverBackupCreateSchema = z.object({
  name: z.string().min(1).max(255),
  ignoredFiles: z.array(z.string()),
});

export const serverBackupEditSchema = z.object({
  name: z.string().min(1).max(255),
  locked: z.boolean(),
});
