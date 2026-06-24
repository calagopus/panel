import { z } from 'zod';
import { nullableString } from '@/lib/transformers.ts';
import { compressionType } from '../generic.ts';

export const adminBackupConfigurationResticPruneJobSchema = z.object({
  cron: z.string().min(1),
  nodes: z.array(z.string()),
});

export const adminBackupConfigurationResticSchema = z.object({
  repository: z.string(),
  retryLockSeconds: z.number().min(0),
  environment: z.record(z.string(), z.string()),
  pruneJobs: z.array(adminBackupConfigurationResticPruneJobSchema),
});

export const adminBackupConfigurationS3Schema = z.object({
  accessKey: z.string(),
  secretKey: z.string(),
  bucket: z.string(),
  region: z.string(),
  endpoint: z.url({ protocol: /^https?$/ }),
  pathStyle: z.boolean(),
  compressionType: z.lazy(() => compressionType),
  partSize: z.number().min(0),
});

export const adminBackupConfigurationPbsSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  datastore: z.string().min(1).max(255),
  namespace: z.preprocess(nullableString, z.string().max(255).nullable()),
  tokenId: z
    .string()
    .min(1)
    .max(255)
    .regex(
      /^[^\s:/!@]+@[A-Za-z][A-Za-z0-9._-]*![A-Za-z0-9._-]+$/,
      'Must be a Proxmox API token ID in the form user@realm!token-name',
    ),
  tokenSecret: z.string(),
  fingerprint: z
    .string()
    .regex(
      /^(?:[0-9a-fA-F]{2}:){31}[0-9a-fA-F]{2}$|^[0-9a-fA-F]{64}$/,
      'Must be a SHA-256 fingerprint (64 hex characters, colons optional)',
    ),
  backupIdPrefix: z.preprocess(nullableString, z.string().max(255).nullable()),
});

export const adminBackupConfigurationKopiaSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  username: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9][a-z0-9._-]*@[a-z0-9][a-z0-9._-]*$/, 'Must be in the form user@host'),
  password: z.string().min(1).max(255),
  fingerprint: z
    .string()
    .regex(
      /^(?:[0-9a-fA-F]{2}:){31}[0-9a-fA-F]{2}$|^[0-9a-fA-F]{64}$/,
      'Must be a SHA-256 fingerprint (64 hex characters, colons optional)',
    ),
  tags: z.record(z.string().min(1).max(255), z.string().min(1).max(255)),
});

export const adminBackupConfigurationSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  maintenanceEnabled: z.boolean(),
  shared: z.boolean(),
  backupDisk: z.enum(['local', 's3', 'ddup-bak', 'btrfs', 'zfs', 'restic', 'proxmox-backup-server', 'kopia']),
  backupConfigs: z
    .object({
      s3: adminBackupConfigurationS3Schema.nullable(),
      restic: adminBackupConfigurationResticSchema.nullable(),
      pbs: adminBackupConfigurationPbsSchema.nullable(),
      kopia: adminBackupConfigurationKopiaSchema.nullable(),
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
