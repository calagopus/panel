import { ZodType, z } from 'zod';
import { archiveFormatLabelMapping } from '@/lib/enums.ts';

export const serverScheduleStepVariableSchema = z.object({
  variable: z.string(),
});

export const serverScheduleStepDynamicSchema = z.union([z.string(), serverScheduleStepVariableSchema]);

export const serverScheduleComparator = z.enum([
  'smaller_than',
  'smaller_than_or_equals',
  'equal',
  'greater_than',
  'greater_than_or_equals',
]);

export const serverScheduleTriggerCronSchema = z.object({
  type: z.literal('cron'),
  schedule: z.string(),
});

export const serverScheduleTriggerPowerActionSchema = z.object({
  type: z.literal('power_action'),
  action: z.enum(['start', 'stop', 'restart', 'kill']),
});

export const serverScheduleTriggerServerStateSchema = z.object({
  type: z.literal('server_state'),
  state: z.enum(['offline', 'starting', 'stopping', 'running']),
});

export const serverScheduleTriggerBackupStatusSchema = z.object({
  type: z.literal('backup_status'),
  status: z.enum(['starting', 'finished', 'failed']),
});

export const serverScheduleTriggerConsoleLineSchema = z.object({
  type: z.literal('console_line'),
  contains: z.string(),
  caseInsensitive: z.boolean(),
  outputInto: z
    .object({
      variable: z.string(),
    })
    .nullable(),
});

export const serverScheduleTriggerCrashSchema = z.object({
  type: z.literal('crash'),
});

export const serverScheduleTriggerSchema = z.discriminatedUnion('type', [
  serverScheduleTriggerCronSchema,
  serverScheduleTriggerPowerActionSchema,
  serverScheduleTriggerServerStateSchema,
  serverScheduleTriggerBackupStatusSchema,
  serverScheduleTriggerConsoleLineSchema,
  serverScheduleTriggerCrashSchema,
]);

export const serverScheduleConditionNoneSchema = z.object({
  type: z.literal('none'),
});

export const serverSchedulePreConditionServerStateSchema = z.object({
  type: z.literal('server_state'),
  state: z.enum(['offline', 'starting', 'stopping', 'running']),
});

export const serverSchedulePreConditionUptimeSchema = z.object({
  type: z.literal('uptime'),
  value: z.number(),
  comparator: serverScheduleComparator,
});

export const serverSchedulePreConditionCpuUsageSchema = z.object({
  type: z.literal('cpu_usage'),
  value: z.number(),
  comparator: serverScheduleComparator,
});

export const serverSchedulePreConditionMemoryUsageSchema = z.object({
  type: z.literal('memory_usage'),
  value: z.number(),
  comparator: serverScheduleComparator,
});

export const serverSchedulePreConditionDiskUsageSchema = z.object({
  type: z.literal('disk_usage'),
  value: z.number(),
  comparator: serverScheduleComparator,
});

export const serverSchedulePreConditionFileExistsSchema = z.object({
  type: z.literal('file_exists'),
  file: z.string(),
});

export type ServerSchedulePreCondition =
  | z.infer<typeof serverScheduleConditionNoneSchema>
  | {
      type: 'and' | 'or';
      conditions: ServerSchedulePreCondition[];
    }
  | {
      type: 'not';
      condition: ServerSchedulePreCondition;
    }
  | z.infer<typeof serverSchedulePreConditionServerStateSchema>
  | z.infer<typeof serverSchedulePreConditionUptimeSchema>
  | z.infer<typeof serverSchedulePreConditionCpuUsageSchema>
  | z.infer<typeof serverSchedulePreConditionMemoryUsageSchema>
  | z.infer<typeof serverSchedulePreConditionDiskUsageSchema>
  | z.infer<typeof serverSchedulePreConditionFileExistsSchema>;

export const serverSchedulePreConditionSchema: ZodType<ServerSchedulePreCondition> = z.lazy(() =>
  z.discriminatedUnion('type', [
    serverScheduleConditionNoneSchema,

    z.object({
      type: z.literal('and'),
      conditions: z.array(serverSchedulePreConditionSchema),
    }),
    z.object({
      type: z.literal('or'),
      conditions: z.array(serverSchedulePreConditionSchema),
    }),
    z.object({
      type: z.literal('not'),
      condition: serverSchedulePreConditionSchema,
    }),

    serverSchedulePreConditionServerStateSchema,
    serverSchedulePreConditionUptimeSchema,
    serverSchedulePreConditionCpuUsageSchema,
    serverSchedulePreConditionMemoryUsageSchema,
    serverSchedulePreConditionDiskUsageSchema,
    serverSchedulePreConditionFileExistsSchema,
  ]),
);

export const serverScheduleConditionVariableExists = z.object({
  type: z.literal('variable_exists'),
  variable: serverScheduleStepVariableSchema,
});

export const serverScheduleConditionVariableEquals = z.object({
  type: z.literal('variable_equals'),
  variable: serverScheduleStepVariableSchema,
  equals: serverScheduleStepDynamicSchema,
});

export const serverScheduleConditionVariableContains = z.object({
  type: z.literal('variable_contains'),
  variable: serverScheduleStepVariableSchema,
  contains: serverScheduleStepDynamicSchema,
});

export const serverScheduleConditionVariableStartsWith = z.object({
  type: z.literal('variable_starts_with'),
  variable: serverScheduleStepVariableSchema,
  startsWith: serverScheduleStepDynamicSchema,
});

export const serverScheduleConditionVariableEndsWith = z.object({
  type: z.literal('variable_ends_with'),
  variable: serverScheduleStepVariableSchema,
  endsWith: serverScheduleStepDynamicSchema,
});

export type ServerScheduleCondition =
  | z.infer<typeof serverScheduleConditionNoneSchema>
  | {
      type: 'and' | 'or';
      conditions: ServerScheduleCondition[];
    }
  | {
      type: 'not';
      condition: ServerScheduleCondition;
    }
  | z.infer<typeof serverScheduleConditionVariableExists>
  | z.infer<typeof serverScheduleConditionVariableEquals>
  | z.infer<typeof serverScheduleConditionVariableContains>
  | z.infer<typeof serverScheduleConditionVariableStartsWith>
  | z.infer<typeof serverScheduleConditionVariableEndsWith>;

export const serverScheduleConditionSchema: ZodType<ServerScheduleCondition> = z.lazy(() =>
  z.discriminatedUnion('type', [
    serverScheduleConditionNoneSchema,

    z.object({
      type: z.literal('and'),
      conditions: z.array(serverScheduleConditionSchema),
    }),
    z.object({
      type: z.literal('or'),
      conditions: z.array(serverScheduleConditionSchema),
    }),
    z.object({
      type: z.literal('not'),
      condition: serverScheduleConditionSchema,
    }),

    serverScheduleConditionVariableExists,
    serverScheduleConditionVariableEquals,
    serverScheduleConditionVariableContains,
    serverScheduleConditionVariableStartsWith,
    serverScheduleConditionVariableEndsWith,
  ]),
);

export const serverScheduleSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  enabled: z.boolean(),
  triggers: z.array(serverScheduleTriggerSchema),
  condition: serverSchedulePreConditionSchema,
  lastRun: z.date().nullable(),
  lastFailure: z.date().nullable(),
  created: z.date(),
});

export const serverScheduleUpdateSchema = z.lazy(() =>
  serverScheduleSchema.omit({
    uuid: true,
    lastRun: true,
    lastFailure: true,
    created: true,
  }),
);

export const serverScheduleStepSleepSchema = z.object({
  type: z.literal('sleep'),
  duration: z.number().min(0),
});

export const serverScheduleStepEnsureSchema = z.object({
  type: z.literal('ensure'),
  condition: serverScheduleConditionSchema,
});

export const serverScheduleStepFormatSchema = z.object({
  type: z.literal('format'),
  format: z.string(),
  outputInto: serverScheduleStepVariableSchema,
});

export const serverScheduleStepMatchRegexSchema = z.object({
  type: z.literal('match_regex'),
  input: serverScheduleStepDynamicSchema,
  regex: z.string(),
  outputInto: z.array(serverScheduleStepVariableSchema.nullable()),
});

export const serverScheduleStepWaitForConsoleLineSchema = z.object({
  type: z.literal('wait_for_console_line'),
  ignoreFailure: z.boolean(),
  contains: serverScheduleStepDynamicSchema,
  caseInsensitive: z.boolean(),
  timeout: z.number().min(0),
  outputInto: serverScheduleStepVariableSchema.nullable(),
});

export const serverScheduleStepSendPowerSchema = z.object({
  type: z.literal('send_power'),
  ignoreFailure: z.boolean(),
  action: z.enum(['start', 'stop', 'restart', 'kill']),
});

export const serverScheduleStepSendCommandSchema = z.object({
  type: z.literal('send_command'),
  ignoreFailure: z.boolean(),
  command: serverScheduleStepDynamicSchema,
});

export const serverScheduleStepCreateBackupSchema = z.object({
  type: z.literal('create_backup'),
  ignoreFailure: z.boolean(),
  foreground: z.boolean(),
  name: serverScheduleStepDynamicSchema.nullable(),
  ignoredFiles: z.array(z.string()),
});

export const serverScheduleStepCreateDirectorySchema = z.object({
  type: z.literal('create_directory'),
  ignoreFailure: z.boolean(),
  root: serverScheduleStepDynamicSchema,
  name: serverScheduleStepDynamicSchema,
});

export const serverScheduleStepWriteFileSchema = z.object({
  type: z.literal('write_file'),
  ignoreFailure: z.boolean(),
  append: z.boolean(),
  file: serverScheduleStepDynamicSchema,
  content: serverScheduleStepDynamicSchema,
});

export const serverScheduleStepCopyFileSchema = z.object({
  type: z.literal('copy_file'),
  ignoreFailure: z.boolean(),
  foreground: z.boolean(),
  file: serverScheduleStepDynamicSchema,
  destination: serverScheduleStepDynamicSchema,
});

export const serverScheduleStepDeleteFilesSchema = z.object({
  type: z.literal('delete_files'),
  root: serverScheduleStepDynamicSchema,
  files: z.array(z.string()),
});

export const serverScheduleStepRenameFilesSchema = z.object({
  type: z.literal('rename_files'),
  root: serverScheduleStepDynamicSchema,
  files: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
    }),
  ),
});

export const serverScheduleStepCompressFilesSchema = z.object({
  type: z.literal('compress_files'),
  ignoreFailure: z.boolean(),
  foreground: z.boolean(),
  root: serverScheduleStepDynamicSchema,
  files: z.array(z.string()),
  format: z.enum(Object.keys(archiveFormatLabelMapping)),
  name: serverScheduleStepDynamicSchema,
});

export const serverScheduleStepDecompressFileSchema = z.object({
  type: z.literal('decompress_file'),
  ignoreFailure: z.boolean(),
  foreground: z.boolean(),
  root: serverScheduleStepDynamicSchema,
  file: serverScheduleStepDynamicSchema,
});

export const serverScheduleStepUpdateStartupVariableSchema = z.object({
  type: z.literal('update_startup_variable'),
  ignoreFailure: z.boolean(),
  envVariable: serverScheduleStepDynamicSchema,
  value: serverScheduleStepDynamicSchema,
});

export const serverScheduleStepUpdateStartupCommandSchema = z.object({
  type: z.literal('update_startup_command'),
  ignoreFailure: z.boolean(),
  command: serverScheduleStepDynamicSchema,
});

export const serverScheduleStepUpdateStartupDockerImageSchema = z.object({
  type: z.literal('update_startup_docker_image'),
  ignoreFailure: z.boolean(),
  image: serverScheduleStepDynamicSchema,
});

export const serverScheduleStepActionSchema = z.discriminatedUnion('type', [
  serverScheduleStepSleepSchema,
  serverScheduleStepEnsureSchema,
  serverScheduleStepFormatSchema,
  serverScheduleStepMatchRegexSchema,
  serverScheduleStepWaitForConsoleLineSchema,
  serverScheduleStepSendPowerSchema,
  serverScheduleStepSendCommandSchema,
  serverScheduleStepCreateBackupSchema,
  serverScheduleStepCreateDirectorySchema,
  serverScheduleStepWriteFileSchema,
  serverScheduleStepCopyFileSchema,
  serverScheduleStepDeleteFilesSchema,
  serverScheduleStepRenameFilesSchema,
  serverScheduleStepCompressFilesSchema,
  serverScheduleStepDecompressFileSchema,
  serverScheduleStepUpdateStartupVariableSchema,
  serverScheduleStepUpdateStartupCommandSchema,
  serverScheduleStepUpdateStartupDockerImageSchema,
]);

export const serverScheduleStepSchema = z.object({
  uuid: z.string(),
  order: z.number(),
  action: serverScheduleStepActionSchema,
  error: z.string().nullable(),
  created: z.date(),
});

export const serverScheduleStepUpdateSchema = z.lazy(() =>
  serverScheduleStepSchema.omit({
    uuid: true,
    error: true,
    created: true,
  }),
);

export const serverScheduleStatusSchema = z.object({
  running: z.boolean(),
  step: z.string().nullable(),
});
