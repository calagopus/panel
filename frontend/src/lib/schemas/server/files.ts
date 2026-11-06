import { z } from 'zod';
import { archiveFormatLabelMapping } from '@/lib/enums.ts';
import { userSchema } from '@/lib/schemas/user.ts';
import { nullableString } from '@/lib/serialization/transformers.ts';

export const serverFilesArchiveCreateSchema = z.object({
  name: z.string().nullable(),
  format: z.enum(Object.keys(archiveFormatLabelMapping)),
});

export const serverFilesDirectoryCreateSchema = z.object({
  name: z.string().min(1).max(255),
});

export const serverFilesSymlinkCreateSchema = z.object({
  link: z.string().min(1).max(255),
  target: z.string().min(1).max(4095),
});

export const serverFilesCopySchema = z.object({
  name: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
});

export const serverFilesCopyToDirectorySchema = z.object({
  destination: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
});

export const serverFilesCopyRemoteManySchema = z.object({
  destination: z.string().max(255),
  destinationServers: z.array(z.uuid()).min(1).max(25),
});

export const serverFilesExtractSchema = z.object({
  destination: z.string().min(1).max(255),
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

export const serverFilesMatchContextSchema = z.object({
  before: z.number().int().min(0),
  after: z.number().int().min(0),
  maxMatches: z.number().int().min(1),
});

export const serverFileLinesSchema = z.object({
  startLine: z.number().int().min(1).nullable(),
  endLine: z.number().int().min(1).nullable(),
  content: z.string(),
  eof: z.boolean(),
});

export const serverFilesContentMatchesSchema = z.object({
  file: z.string(),
  truncated: z.boolean(),
  blocks: z.array(
    z.object({
      startLine: z.number().int().min(1),
      endLine: z.number().int().min(1),
      content: z.string(),
      matches: z.array(
        z.object({
          startByte: z.number().int().min(0),
          endByte: z.number().int().min(0),
        }),
      ),
    }),
  ),
});

export const serverFilesSearchSchema = z.object({
  matchContext: serverFilesMatchContextSchema.optional(),
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
  startTime: z.coerce.date(),
  bytesProcessed: z.number(),
  bytesTotal: z.number(),
});

export const serverFileOperationCompressSchema = z.lazy(() =>
  serverFileOperationBaseSchema.extend({
    type: z.literal('compress'),
    path: z.string(),
    files: z.array(z.string()),
    filesProcessed: z.number(),
  }),
);

export const serverFileOperationDecompressSchema = z.lazy(() =>
  serverFileOperationBaseSchema.extend({
    type: z.literal('decompress'),
    path: z.string(),
    destinationPath: z.string(),
    filesProcessed: z.number(),
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
    filesProcessed: z.number(),
  }),
);

export const serverFileOperationCopyManySchema = z.lazy(() =>
  serverFileOperationBaseSchema.extend({
    type: z.literal('copy_many'),
    path: z.string(),
    files: z.array(z.object({ from: z.string(), to: z.string() })),
    filesProcessed: z.number(),
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
    filesProcessed: z.number(),
  }),
);

export const serverFileOperationExportBackupSchema = z.lazy(() =>
  serverFileOperationBaseSchema.extend({
    type: z.literal('export_backup'),
    backup: z.string(),
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
  serverFileOperationExportBackupSchema,
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
  virtual: z.boolean(),
  mime: z.string(),
  modified: z.coerce.date(),
  created: z.coerce.date(),
});

export const serverFilesCopyRemoteManyResultSchema = z.object({
  server: z.uuid(),
  identifier: z.uuid().nullable(),
  error: z.string().nullable(),
  skipped: z.array(serverDirectoryEntrySchema),
});

export const serverDirectorySizesSchema = z.object({
  name: z.string(),
  size: z.number(),
  sizePhysical: z.number(),
  filesSize: z.number(),
  inaccessibleSize: z.number(),
  otherSize: z.number(),
  otherCount: z.number(),
  truncated: z.boolean(),
  get children() {
    return z.array(serverDirectorySizesSchema);
  },
});

export const serverDirectoryUploadSchema = z.object({
  name: z.string(),
  targetName: z.string(),
  directory: z.string(),
  user: z.uuid().nullable(),
  userName: z.string().nullable(),
  uploaded: z.number(),
  total: z.number().nullable(),
  resumable: z.boolean(),
  active: z.boolean(),
  started: z.coerce.date().nullable(),
  updated: z.coerce.date().nullable(),
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

export const serverFileRevisionSchema = z.object({
  id: z.number(),
  user: userSchema.nullable(),
  size: z.number(),
  isSnapshot: z.boolean(),
  created: z.coerce.date(),
});

export const serverFileSqliteQuerySchema = z.object({
  file: z.string().min(1),
  query: z.string().min(1).max(65535),
  rows: z.number().min(1).max(1000),
  readOnly: z.boolean(),
});

export const serverTrashEntrySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  path: z.string(),
  directory: z.boolean(),
  file: z.boolean(),
  size: z.number(),
  deleted: z.coerce.date(),
});

export const serverTrashRestoredFileSchema = z.object({
  from: z.string(),
  to: z.string(),
  restoration: z.string().nullable(),
});

export const serverTrashSelectorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('uuids'), uuids: z.array(z.string()) }),
  z.object({ type: z.literal('all') }),
]);

export const serverTrashRestoreToSchema = z.object({
  destination: z.string().min(1).max(255),
  names: z.array(
    z
      .string()
      .min(1)
      .max(255)
      .refine((val) => !val.includes('/')),
  ),
});
