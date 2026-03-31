import { z } from 'zod';
import { nullableString } from '@/lib/transformers.ts';

export const adminBackupConfigurationResticSchema = z.object({
  repository: z.string(),
  retryLockSeconds: z.number().min(0),
  environment: z.record(z.string(), z.string()),
});

export const adminBackupConfigurationS3Schema = z.object({
  accessKey: z.string(),
  secretKey: z.string(),
  bucket: z.string(),
  region: z.string(),
  endpoint: z.url({ protocol: /^https?$/ }),
  pathStyle: z.boolean(),
  partSize: z.number().min(0),
});

export const adminBackupConfigurationSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  maintenanceEnabled: z.boolean(),
  backupDisk: z.enum(['local', 's3', 'ddup-bak', 'btrfs', 'zfs', 'restic']),
  backupConfigs: z
    .object({
      s3: adminBackupConfigurationS3Schema.nullable(),
      restic: adminBackupConfigurationResticSchema.nullable(),
    })
    .optional(),
  created: z.date(),
});

export const adminBackupConfigurationUpdateSchema = z.lazy(() =>
  adminBackupConfigurationSchema.omit({
    uuid: true,
    created: true,
  }),
);
