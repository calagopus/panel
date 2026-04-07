import { z } from 'zod';
import { adminServerFeatureLimitsSchema, adminServerLimitsSchema } from '@/lib/schemas/admin/servers.ts';
import { nullableString } from '../transformers.ts';

export const oobeStepKey = z
  .enum(['register', 'configuration', 'repositories', 'location', 'node', 'nodeconfiguration', 'server', 'finished'])
  .nullable();

export const oobeConfigurationSchema = z.object({
  applicationName: z.string().min(3).max(255),
  applicationLanguage: z.string(),
  applicationUrl: z.url({ protocol: /^https?$/ }),
  applicationRegistration: z.boolean(),
});

export const oobeLocationSchema = z.object({
  locationName: z.string().min(3).max(255),
  backupName: z.string().min(3).max(255),
  backupDisk: z.enum(['local', 's3', 'ddup-bak', 'btrfs', 'zfs', 'restic']),
});

export const oobeLoginSchema = z.object({
  username: z.string(),
  password: z.string().max(512),
});

export const oobeNodeSchema = z.object({
  name: z.string().min(3).max(255),
  publicUrl: z.preprocess(
    nullableString,
    z
      .url({ protocol: /^https?$/ })
      .min(3)
      .max(255)
      .nullable(),
  ),
  url: z
    .url({ protocol: /^https?$/ })
    .min(3)
    .max(255),
  sftpHost: z.preprocess(nullableString, z.string().min(3).max(255).nullable()),
  sftpPort: z.number().min(1).max(65535),
  memory: z.number(),
  disk: z.number(),
});

export const oobeRegister = z
  .object({
    username: z
      .string()
      .min(3)
      .max(15)
      .regex(/^[a-zA-Z0-9_]+$/),
    email: z.email(),
    nameFirst: z.string().min(2).max(255),
    nameLast: z.string().min(2).max(255),
    password: z.string().min(8).max(512),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const oobeServerSchema = z.object({
  nestName: z.string().min(3).max(255),
  name: z.string().min(3).max(255),
  limits: z.lazy(() =>
    adminServerLimitsSchema.omit({
      memoryOverhead: true,
      ioWeight: true,
    }),
  ),
  image: z.string().min(2).max(255),
  startOnCompletion: z.boolean(),
  featureLimits: z.lazy(() => adminServerFeatureLimitsSchema),
  allocationUuid: z.uuid().nullable(),
  allocationUuids: z.array(z.uuid()),
});
