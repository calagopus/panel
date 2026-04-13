import { z } from 'zod';

export const databaseType = z.enum(['mysql', 'postgres', 'mongodb']);

export const databaseHostSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  host: z.string().nullable(),
  port: z.number(),
  type: databaseType,
});

export const oAuthProviderSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  linkViewable: z.boolean(),
  userManageable: z.boolean(),
});

export const permissionMapSchema = z.record(
  z.string(),
  z.object({
    description: z.string(),
    permissions: z.record(z.string(), z.string()),
  }),
);

export const apiPermissionsSchema = z.object({
  userPermissions: permissionMapSchema,
  serverPermissions: permissionMapSchema,
  adminPermissions: permissionMapSchema,
});

export const eggConfigurationRouteItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('route'), path: z.string() }),
  z.object({
    type: z.literal('divider'),
    name: z.string().nullable(),
    nameTranslations: z.record(z.string(), z.string()),
  }),
  z.object({
    type: z.literal('redirect'),
    name: z.string(),
    nameTranslations: z.record(z.string(), z.string()),
    destination: z.string(),
  }),
]);

export const streamingArchiveFormat = z.enum([
  'tar',
  'tar_gz',
  'tar_xz',
  'tar_lzip',
  'tar_bz2',
  'tar_lz4',
  'tar_zstd',
  'zip',
]);
