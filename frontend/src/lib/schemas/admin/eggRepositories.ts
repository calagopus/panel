import { z } from 'zod';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { nullableString } from '@/lib/serialization/transformers.ts';

export const adminEggRepositoryCredentialsNoneSchema = z.object({
  type: z.literal('none'),
});

export const adminEggRepositoryCredentialsPasswordSchema = z.object({
  type: z.literal('password'),
  username: z.string(),
  password: z.string(),
});

export const adminEggRepositoryCredentialsPrivateKeySchema = z.object({
  type: z.literal('private_key'),
  username: z.string(),
  privateKey: z.string(),
  passphrase: z.preprocess(nullableString, z.string().nullable()),
});

export const adminEggRepositoryCredentialsSchema = z.discriminatedUnion('type', [
  adminEggRepositoryCredentialsNoneSchema,
  adminEggRepositoryCredentialsPasswordSchema,
  adminEggRepositoryCredentialsPrivateKeySchema,
]);

export const adminEggRepositorySchema = z.looseObject({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  gitRepository: z.union([z.url({ protocol: /^(https?|ssh)$/ }), z.string().regex(/^[^/:]+:(?!\/\/).+$/)]),
  credentials: adminEggRepositoryCredentialsSchema,
  defaultNest: adminNestSchema.nullable(),
  autoSync: z.boolean(),
  lastSynced: z.coerce.date().nullable(),
  created: z.coerce.date(),
});

export const adminEggRepositoryCredentialsPasswordUpdateSchema = z.object({
  type: z.literal('password'),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(255),
});

export const adminEggRepositoryCredentialsPrivateKeyUpdateSchema = z.object({
  type: z.literal('private_key'),
  username: z.string().min(1).max(255),
  privateKey: z.string().min(1).max(16384),
  passphrase: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
});

export const adminEggRepositoryCredentialsUpdateSchema = z.discriminatedUnion('type', [
  adminEggRepositoryCredentialsNoneSchema,
  adminEggRepositoryCredentialsPasswordUpdateSchema,
  adminEggRepositoryCredentialsPrivateKeyUpdateSchema,
]);

export const adminEggRepositoryUpdateSchema = z.lazy(() =>
  adminEggRepositorySchema
    .omit({
      uuid: true,
      created: true,
      credentials: true,
      defaultNest: true,
      lastSynced: true,
    })
    .extend({
      credentials: adminEggRepositoryCredentialsUpdateSchema.optional(),
      defaultNestUuid: z.uuid().nullable(),
    }),
);

export const adminEggRepositoryEggSchema = z.looseObject({
  uuid: z.string(),
  path: z.string(),
  readme: z.string().nullable(),
  banner: z.string().nullable(),
  exportedEgg: z.looseObject({
    name: z.string(),
    description: z.string().nullable(),
    author: z.string(),
    startupCommands: z.record(z.string(), z.string()),
    dockerImages: z.record(z.string(), z.string()),
  }),
  hash: z.string(),
  updated: z.coerce.date(),
});

export const adminEggEggRepositoryEggSchema = z.lazy(() =>
  adminEggRepositoryEggSchema.extend({
    eggRepository: z.lazy(() => adminEggRepositorySchema),
  }),
);

export const adminEggRepositoryEggInstalledEggSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  eggRepositoryEggHash: z.string().nullable(),
  nest: adminNestSchema,
});

export const adminEggRepositoryCatalogEggSchema = z.object({
  egg: adminEggEggRepositoryEggSchema,
  installedEggs: z.array(adminEggRepositoryEggInstalledEggSchema),
});

export const adminEggRepositoryCountsSchema = z.record(
  z.string(),
  z.object({
    eggRepositoryEggs: z.number(),
  }),
);
