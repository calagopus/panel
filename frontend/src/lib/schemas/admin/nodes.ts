import { z } from 'zod';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminServerBackupSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { nullableString } from '@/lib/transformers.ts';
import { hostnameSchema } from '../generic.ts';

export const adminNodeSchema = z.looseObject({
  uuid: z.string(),
  location: z.lazy(() => adminLocationSchema),
  backupConfiguration: z.lazy(() => adminBackupConfigurationSchema).nullable(),
  name: z.string().min(1).max(255),
  deploymentEnabled: z.boolean(),
  maintenanceEnabled: z.boolean(),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
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
  sftpHost: z.preprocess(nullableString, hostnameSchema.nullable()),
  sftpPort: z.number().min(0).max(65535),
  memory: z.number().min(0),
  disk: z.number().min(0),
  created: z.coerce.date(),
});

export const adminNodeTokenSchema = z.object({
  tokenId: z.string(),
  token: z.string(),
});

export const adminNodeCapacitySchema = z.object({
  limits: z.object({
    memory: z.number(),
    disk: z.number(),
  }),
  allocated: z.object({
    servers: z.number(),
    cpu: z.number(),
    memory: z.number(),
    memoryOverhead: z.number(),
    disk: z.number(),
  }),
});

export const adminNodeUpdateSchema = z.lazy(() =>
  adminNodeSchema
    .omit({
      uuid: true,
      location: true,
      backupConfiguration: true,
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

export const adminNodeAllocationSchema = z.looseObject({
  uuid: z.string(),
  server: z.lazy(() => adminServerSchema).nullable(),
  ip: z.string(),
  ipAlias: z.string().nullable(),
  port: z.number(),
  created: z.string(),
});

export const adminNodeAllocationsSchema = z.object({
  ip: z.string().min(1),
  ipAlias: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
  ports: z.array(z.string()).min(1),
});

export const adminNodeMountSchema = z.looseObject({
  mount: z.lazy(() => adminMountSchema),
  created: z.coerce.date(),
});

export const adminNodeTransferProgressSchema = z.object({
  archiveBytesProcessed: z.number(),
  networkBytesProcessed: z.number(),
  bytesTotal: z.number(),
  filesProcessed: z.number(),
});
