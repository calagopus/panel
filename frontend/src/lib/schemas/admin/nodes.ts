import { z } from 'zod';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminServerBackupSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { nullableString } from '@/lib/transformers.ts';

export const adminNodeSchema = z.object({
  uuid: z.string(),
  location: z.lazy(() => adminLocationSchema),
  backupConfiguration: z.lazy(() => adminBackupConfigurationSchema).nullable(),
  name: z.string().min(3).max(255),
  deploymentEnabled: z.boolean(),
  maintenanceEnabled: z.boolean(),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  publicUrl: z.preprocess(nullableString, z.httpUrl().min(3).max(255).nullable()),
  url: z.httpUrl().min(3).max(255),
  sftpHost: z.preprocess(nullableString, z.string().min(3).max(255).nullable()),
  sftpPort: z.number().min(0).max(65535),
  memory: z.number().min(0),
  disk: z.number().min(0),
  tokenId: z.string(),
  token: z.string(),
  created: z.date(),
});

export const adminNodeUpdateSchema = z.lazy(() =>
  adminNodeSchema
    .omit({
      uuid: true,
      location: true,
      backupConfiguration: true,
      tokenId: true,
      token: true,
      created: true,
    })
    .extend({
      locationUuid: z.uuid(),
      backupConfigurationUuid: z.uuid().nullable(),
    }),
);

export const adminNodeServerBackupSchema = z.lazy(() =>
  adminServerBackupSchema.extend({
    node: adminNodeSchema,
  }),
);

export const adminNodeAllocationSchema = z.object({
  uuid: z.string(),
  server: z.lazy(() => adminServerSchema).nullable(),
  ip: z.string(),
  ipAlias: z.string().nullable(),
  port: z.number(),
  created: z.string(),
});

export const adminNodeAllocationsSchema = z.object({
  ip: z.string(),
  ipAlias: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
  ports: z.array(z.string()),
});

export const adminNodeMountSchema = z.object({
  mount: z.lazy(() => adminMountSchema),
  created: z.date(),
});

export const adminNodeTransferProgressSchema = z.object({
  archiveProgress: z.number(),
  networkProgress: z.number(),
  total: z.number(),
});
