import { ZodType, z } from 'zod';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { nullableString } from '@/lib/transformers.ts';

export const adminOAuthProviderSchema = z.looseObject({
  uuid: z.string(),
  name: z.string().min(1).max(255),
  description: z.preprocess(nullableString, z.string().max(1024).nullable()),
  clientId: z.string().min(3).max(255),
  clientSecret: z.string().min(3).max(255),
  authUrl: z.string().min(3).max(255),
  tokenUrl: z.string().min(3).max(255),
  infoUrl: z.string().min(3).max(255),
  scopes: z.array(z.string()),
  identifierPath: z.string().min(3).max(255),
  emailPath: z.preprocess(nullableString, z.string().min(3).max(255).nullable()),
  usernamePath: z.preprocess(nullableString, z.string().min(3).max(255).nullable()),
  nameFirstPath: z.preprocess(nullableString, z.string().min(3).max(255).nullable()),
  nameLastPath: z.preprocess(nullableString, z.string().min(3).max(255).nullable()),
  enabled: z.boolean(),
  loginOnly: z.boolean(),
  loginBypass2fa: z.boolean(),
  linkViewable: z.boolean(),
  userManageable: z.boolean(),
  basicAuth: z.boolean(),
  created: z.coerce.date(),
});

export const adminOAuthProviderUpdateSchema = z.lazy(() =>
  adminOAuthProviderSchema.omit({
    uuid: true,
    created: true,
  }),
);

export const adminOAuthUserLinkSchema = z.looseObject({
  uuid: z.string(),
  user: z.lazy(() => adminFullUserSchema),
  identifier: z.string(),
  lastUsed: z.coerce.date().nullable(),
  created: z.coerce.date(),
});

export const adminOAuthProviderMappingMatcherNoneSchema = z.object({
  type: z.literal('none'),
});

export const adminOAuthProviderMappingMatcherScopesSchema = z.object({
  type: z.literal('scopes'),
  scopes: z.array(z.string()),
});

export const adminOAuthProviderMappingMatcherFieldExistsSchema = z.object({
  type: z.literal('field_exists'),
  path: z.string(),
});

export const adminOAuthProviderMappingMatcherFieldEqualsSchema = z.object({
  type: z.literal('field_equals'),
  path: z.string(),
  equals: z.string(),
});

export const adminOAuthProviderMappingMatcherFieldContainsSchema = z.object({
  type: z.literal('field_contains'),
  path: z.string(),
  contains: z.string(),
});

export const adminOAuthProviderMappingMatcherFieldStartsWithSchema = z.object({
  type: z.literal('field_starts_with'),
  path: z.string(),
  startsWith: z.string(),
});

export const adminOAuthProviderMappingMatcherFieldEndsWithSchema = z.object({
  type: z.literal('field_ends_with'),
  path: z.string(),
  endsWith: z.string(),
});

export type AdminOAuthProviderMappingMatcher =
  | z.infer<typeof adminOAuthProviderMappingMatcherNoneSchema>
  | {
      type: 'and' | 'or';
      matchers: AdminOAuthProviderMappingMatcher[];
    }
  | {
      type: 'not';
      matcher: AdminOAuthProviderMappingMatcher;
    }
  | z.infer<typeof adminOAuthProviderMappingMatcherScopesSchema>
  | z.infer<typeof adminOAuthProviderMappingMatcherFieldExistsSchema>
  | z.infer<typeof adminOAuthProviderMappingMatcherFieldEqualsSchema>
  | z.infer<typeof adminOAuthProviderMappingMatcherFieldContainsSchema>
  | z.infer<typeof adminOAuthProviderMappingMatcherFieldStartsWithSchema>
  | z.infer<typeof adminOAuthProviderMappingMatcherFieldEndsWithSchema>;

export const adminOAuthProviderMappingMatcherSchema: ZodType<AdminOAuthProviderMappingMatcher> = z.lazy(() =>
  z.discriminatedUnion('type', [
    adminOAuthProviderMappingMatcherNoneSchema,

    z.object({
      type: z.literal('and'),
      matchers: z.array(adminOAuthProviderMappingMatcherSchema),
    }),
    z.object({
      type: z.literal('or'),
      matchers: z.array(adminOAuthProviderMappingMatcherSchema),
    }),
    z.object({
      type: z.literal('not'),
      matcher: adminOAuthProviderMappingMatcherSchema,
    }),

    adminOAuthProviderMappingMatcherScopesSchema,
    adminOAuthProviderMappingMatcherFieldExistsSchema,
    adminOAuthProviderMappingMatcherFieldEqualsSchema,
    adminOAuthProviderMappingMatcherFieldContainsSchema,
    adminOAuthProviderMappingMatcherFieldStartsWithSchema,
    adminOAuthProviderMappingMatcherFieldEndsWithSchema,
  ]),
);

export const adminOAuthProviderMappingTypeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('role'),
    roleUuid: z.string(),
    revokeUnmatched: z.boolean(),
  }),
  z.object({
    type: z.literal('server_subuser'),
    serverUuid: z.string(),
    permissions: z.array(z.string()),
    ignoredFiles: z.array(z.string()),
    revokeUnmatched: z.boolean(),
  }),
]);

export const adminOAuthProviderMappingSchema = z.looseObject({
  uuid: z.string(),
  matcher: adminOAuthProviderMappingMatcherSchema,
  mapping: adminOAuthProviderMappingTypeSchema,
  created: z.coerce.date(),
});

export const adminOAuthProviderMappingCreateSchema = z.object({
  matcher: adminOAuthProviderMappingMatcherSchema,
  mapping: adminOAuthProviderMappingTypeSchema,
});
