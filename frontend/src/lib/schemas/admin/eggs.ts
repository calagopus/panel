import { z } from 'zod';
import { adminEggEggRepositoryEggSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { nullableString } from '@/lib/transformers.ts';

export const adminEggConfigScriptSchema = z.object({
  container: z.string().min(2).max(255),
  content: z.string(),
  entrypoint: z.string().min(2).max(255),
});

export const adminEggSchema = z.object({
  uuid: z.string(),
  eggRepositoryEgg: adminEggEggRepositoryEggSchema.nullable(),
  author: z.string().min(2).max(255),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  configFiles: z.array(
    z.object({
      file: z.string(),
      parser: z.enum(['file', 'yaml', 'properties', 'ini', 'json', 'xml', 'toml']),
      createNew: z.boolean(),
      replace: z.array(
        z.object({
          match: z.string(),
          insertNew: z.boolean(),
          updateExisting: z.boolean(),
          ifValue: z.preprocess(nullableString, z.string().nullable()),
          replaceWith: z.string(),
        }),
      ),
    }),
  ),
  configScript: z.lazy(() => adminEggConfigScriptSchema),
  configStartup: z.object({
    done: z.array(z.string()),
    stripAnsi: z.boolean(),
  }),
  configStop: z.object({
    type: z.string(),
    value: z.preprocess(nullableString, z.string().nullable()),
  }),
  startupCommands: z.record(z.string(), z.string()),
  forceOutgoingIp: z.boolean(),
  separatePort: z.boolean(),
  features: z.array(z.string()),
  dockerImages: z.record(z.string(), z.string()),
  fileDenylist: z.array(z.string()),
  created: z.coerce.date(),
});

export const adminEggCreateSchema = z.lazy(() =>
  adminEggSchema
    .omit({
      uuid: true,
      eggRepositoryEgg: true,
      created: true,
    })
    .extend({
      eggRepositoryEggUuid: z.uuid().nullable(),
    }),
);

export const adminEggUpdateSchema = z.lazy(() =>
  adminEggSchema
    .omit({
      uuid: true,
      eggRepositoryEgg: true,
      configScript: true,
      created: true,
    })
    .extend({
      eggRepositoryEggUuid: z.uuid().nullable(),
    }),
);

export const adminEggVariableSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  nameTranslations: z.record(z.string(), z.string().min(1).max(255)),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  descriptionTranslations: z.record(z.string(), z.string().min(1).max(1024)),
  order: z.number(),
  envVariable: z.string().min(1).max(255),
  defaultValue: z.preprocess(nullableString, z.string().max(1024).nullable()),
  userViewable: z.boolean(),
  userEditable: z.boolean(),
  isSecret: z.boolean(),
  rules: z.array(z.string()),
  created: z.coerce.date(),
});

export const adminEggVariableUpdateSchema = z.lazy(() =>
  adminEggVariableSchema
    .omit({
      uuid: true,
      isSecret: true,
      created: true,
    })
    .extend({
      secret: z.boolean(),
    }),
);

export const processConfigurationConfigParser = z.enum(['file', 'yaml', 'properties', 'ini', 'json', 'xml', 'toml']);
