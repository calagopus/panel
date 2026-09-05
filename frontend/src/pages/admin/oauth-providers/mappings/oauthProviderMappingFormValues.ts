import { z } from 'zod';
import {
  type AdminOAuthProviderMappingMatcher,
  adminOAuthProviderMappingCreateSchema,
  adminOAuthProviderMappingSchema,
} from '@/lib/schemas/admin/oauthProviders.ts';

export type OAuthProviderMappingType = 'role' | 'server_subuser';

export type OAuthProviderMappingFormValues = {
  matcher: AdminOAuthProviderMappingMatcher;
  type: OAuthProviderMappingType;
  roleUuid: string;
  serverUuid: string;
  permissions: string[];
  ignoredFiles: string[];
  revokeUnmatched: boolean;
};

export const oauthProviderMappingEmptyFormValues: OAuthProviderMappingFormValues = {
  matcher: { type: 'none' },
  type: 'role',
  roleUuid: '',
  serverUuid: '',
  permissions: [],
  ignoredFiles: [],
  revokeUnmatched: false,
};

export const oauthProviderMappingToFormValues = (
  mapping: z.infer<typeof adminOAuthProviderMappingSchema>,
): OAuthProviderMappingFormValues => ({
  matcher: mapping.matcher,
  type: mapping.mapping.type,
  roleUuid: mapping.mapping.type === 'role' ? mapping.mapping.roleUuid : '',
  serverUuid: mapping.mapping.type === 'server_subuser' ? mapping.mapping.serverUuid : '',
  permissions: mapping.mapping.type === 'server_subuser' ? mapping.mapping.permissions : [],
  ignoredFiles: mapping.mapping.type === 'server_subuser' ? mapping.mapping.ignoredFiles : [],
  revokeUnmatched: mapping.mapping.revokeUnmatched,
});

export const oauthProviderMappingFormValuesToPayload = (
  values: OAuthProviderMappingFormValues,
): z.infer<typeof adminOAuthProviderMappingCreateSchema> => ({
  matcher: values.matcher,
  mapping:
    values.type === 'role'
      ? { type: 'role' as const, roleUuid: values.roleUuid, revokeUnmatched: values.revokeUnmatched }
      : {
          type: 'server_subuser' as const,
          serverUuid: values.serverUuid,
          permissions: values.permissions,
          ignoredFiles: values.ignoredFiles,
          revokeUnmatched: values.revokeUnmatched,
        },
});
