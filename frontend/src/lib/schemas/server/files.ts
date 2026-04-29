import { z } from 'zod';
import { archiveFormatLabelMapping } from '@/lib/enums.ts';
import { nullableString } from '@/lib/transformers.ts';

export const serverFilesArchiveCreateSchema = z.object({
  name: z.string().nullable(),
  format: z.enum(Object.keys(archiveFormatLabelMapping)),
});

export const serverFilesDirectoryCreateSchema = z.object({
  name: z.string().min(1).max(255),
});

export const serverFilesCopySchema = z.object({
  name: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
});

export const serverFilesCopyRemoteSchema = z.object({
  destination: z.string().min(1).max(255),
  destinationServer: z.uuid(),
});

export const serverFilesNameSchema = z.object({
  name: z.string().min(1).max(255),
});

export const serverFilesPullSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  name: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
});

export const serverFilesFingerprintSchema = z.object({
  algorithm: z.lazy(() => fingerprintAlgorithm),
});

export const serverFilesSearchSchema = z.object({
  pathFilter: z
    .object({
      include: z.string().array(),
      exclude: z.string().array(),
      caseInsensitive: z.boolean(),
    })
    .nullable(),
  sizeFilter: z
    .object({
      min: z.number().min(0),
      max: z.number().min(0),
    })
    .nullable(),
  contentFilter: z
    .object({
      query: z.string().min(1),
      maxSearchSize: z.number().min(0),
      includeUnmatched: z.boolean(),
      caseInsensitive: z.boolean(),
    })
    .nullable(),
});

export const serverFileOperationBaseSchema = z.object({
  startTime: z.date(),
  progress: z.number(),
  total: z.number(),
});

export const serverFileOperationCompressSchema = z.lazy(() =>
  serverFileOperationBaseSchema.extend({
    type: z.literal('compress'),
    path: z.string(),
    files: z.array(z.string()),
  }),
);

export const serverFileOperationDecompressSchema = z.lazy(() =>
  serverFileOperationBaseSchema.extend({
    type: z.literal('decompress'),
    path: z.string(),
    destinationPath: z.string(),
  }),
);

export const serverFileOperationPullSchema = z.lazy(() =>
  serverFileOperationBaseSchema.extend({
    type: z.literal('pull'),
    destinationPath: z.string(),
  }),
);

export const serverFileOperationCopySchema = z.lazy(() =>
  serverFileOperationBaseSchema.extend({
    type: z.literal('copy'),
    path: z.string(),
    destinationPath: z.string(),
  }),
);

export const serverFileOperationCopyManySchema = z.lazy(() =>
  serverFileOperationBaseSchema.extend({
    type: z.literal('copy_many'),
    path: z.string(),
    files: z.array(z.object({ from: z.string(), to: z.string() })),
  }),
);

export const serverFileOperationCopyRemoteSchema = z.lazy(() =>
  serverFileOperationBaseSchema.extend({
    type: z.literal('copy_remote'),
    server: z.string(),
    path: z.string(),
    files: z.array(z.string()),
    destinationServer: z.string(),
    destinationPath: z.string(),
  }),
);

export const serverFileOperationSchema = z.discriminatedUnion('type', [
  serverFileOperationCompressSchema,
  serverFileOperationDecompressSchema,
  serverFileOperationPullSchema,
  serverFileOperationCopySchema,
  serverFileOperationCopyManySchema,
  serverFileOperationCopyRemoteSchema,
]);

export const serverDirectorySortingModeSchema = z.enum([
  'name_asc',
  'name_desc',
  'size_asc',
  'size_desc',
  'physical_size_asc',
  'physical_size_desc',
  'modified_asc',
  'modified_desc',
  'created_asc',
  'created_desc',
]);

export const serverDirectoryEntrySchema = z.object({
  name: z.string(),
  mode: z.string(),
  modeBits: z.string(),
  size: z.number(),
  sizePhysical: z.number(),
  editable: z.boolean(),
  innerEditable: z.boolean(),
  directory: z.boolean(),
  file: z.boolean(),
  symlink: z.boolean(),
  mime: z.string(),
  modified: z.date(),
  created: z.date(),
});

export const serverFilesPullQueryResultSchema = z.object({
  fileName: z.string().nullable(),
  fileSize: z.number().nullable(),
  finalUrl: z.string(),
  headers: z.record(z.string(), z.string()),
});

export const archiveFormat = z.enum([
  'tar',
  'tar_gz',
  'tar_xz',
  'tar_lzip',
  'tar_bz2',
  'tar_lz4',
  'tar_zstd',
  'zip',
  'seven_zip',
]);

export const compressionLevel = z.enum(['best_speed', 'good_speed', 'good_compression', 'best_compression']);

export const fingerprintAlgorithm = z.enum([
  'md5',
  'crc32',
  'sha1',
  'sha224',
  'sha256',
  'sha384',
  'sha512',
  'curseforge',
]);

export const downloadSchema = z.object({
  identifier: z.string(),
  destination: z.string(),
  progress: z.number(),
  total: z.number(),
});
