import { z } from 'zod';
import {
  type AdminOAuthProviderMappingMatcher,
  adminOAuthProviderMappingCreateSchema,
  adminOAuthProviderMappingSchema,
} from '@/lib/schemas/admin/oauthProviders.ts';
import { userTeamMemberManagement } from '@/lib/schemas/user/teams.ts';

export type OAuthProviderMappingType = 'role' | 'server_subuser' | 'team_member';

export type OAuthProviderMappingFormValues = {
  name: string;
  matcher: AdminOAuthProviderMappingMatcher;
  type: OAuthProviderMappingType;
  roleUuid: string;
  serverUuid: string;
  permissions: string[];
  ignoredFiles: string[];
  teamUuid: string;
  presetUuid: string;
  management: z.infer<typeof userTeamMemberManagement>[];
  revokeUnmatched: boolean;
};

export const oauthProviderMappingEmptyFormValues: OAuthProviderMappingFormValues = {
  name: '',
  matcher: { type: 'none' },
  type: 'role',
  roleUuid: '',
  serverUuid: '',
  permissions: [],
  ignoredFiles: [],
  teamUuid: '',
  presetUuid: '',
  management: [],
  revokeUnmatched: false,
};

export const oauthProviderMappingToFormValues = (
  mapping: z.infer<typeof adminOAuthProviderMappingSchema>,
): OAuthProviderMappingFormValues => ({
  name: mapping.name ?? '',
  matcher: mapping.matcher,
  type: mapping.mapping.type,
  roleUuid: mapping.mapping.type === 'role' ? mapping.mapping.roleUuid : '',
  serverUuid: mapping.mapping.type === 'server_subuser' ? mapping.mapping.serverUuid : '',
  permissions: mapping.mapping.type === 'server_subuser' ? mapping.mapping.permissions : [],
  ignoredFiles: mapping.mapping.type === 'server_subuser' ? mapping.mapping.ignoredFiles : [],
  teamUuid: mapping.mapping.type === 'team_member' ? mapping.mapping.teamUuid : '',
  presetUuid: mapping.mapping.type === 'team_member' ? mapping.mapping.presetUuid : '',
  management: mapping.mapping.type === 'team_member' ? mapping.mapping.management : [],
  revokeUnmatched: mapping.mapping.revokeUnmatched,
});

const oauthProviderMappingFormValuesToMapping = (
  values: OAuthProviderMappingFormValues,
): z.infer<typeof adminOAuthProviderMappingCreateSchema>['mapping'] => {
  switch (values.type) {
    case 'role':
      return { type: 'role', roleUuid: values.roleUuid, revokeUnmatched: values.revokeUnmatched };
    case 'server_subuser':
      return {
        type: 'server_subuser',
        serverUuid: values.serverUuid,
        permissions: values.permissions,
        ignoredFiles: values.ignoredFiles,
        revokeUnmatched: values.revokeUnmatched,
      };
    case 'team_member':
      return {
        type: 'team_member',
        teamUuid: values.teamUuid,
        presetUuid: values.presetUuid,
        management: values.management,
        revokeUnmatched: values.revokeUnmatched,
      };
  }
};

export const oauthProviderMappingFormValuesToPayload = (
  values: OAuthProviderMappingFormValues,
): z.infer<typeof adminOAuthProviderMappingCreateSchema> => ({
  name: values.name || null,
  matcher: values.matcher,
  mapping: oauthProviderMappingFormValuesToMapping(values),
});
