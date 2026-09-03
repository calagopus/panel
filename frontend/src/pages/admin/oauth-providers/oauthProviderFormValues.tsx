import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import { adminOAuthProviderSchema, adminOAuthProviderUpdateSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type OAuthFormValues = z.infer<typeof adminOAuthProviderUpdateSchema>;

export const oauthProviderEmptyFormValues: OAuthFormValues = {
  name: '',
  description: null,
  clientId: '',
  clientSecret: '',
  authUrl: '',
  tokenUrl: '',
  infoUrl: '',
  scopes: [],
  identifierPath: '',
  emailPath: null,
  usernamePath: null,
  nameFirstPath: null,
  nameLastPath: null,
  enabled: true,
  loginOnly: false,
  loginBypassTwoFactor: false,
  linkViewable: true,
  userManageable: true,
  basicAuth: false,
};

export const oauthProviderToFormValues = (
  provider: z.infer<typeof adminOAuthProviderSchema>,
): Partial<OAuthFormValues> => ({
  name: provider.name,
  description: provider.description,
  clientId: provider.clientId,
  clientSecret: provider.clientSecret,
  authUrl: provider.authUrl,
  tokenUrl: provider.tokenUrl,
  infoUrl: provider.infoUrl,
  scopes: provider.scopes,
  identifierPath: provider.identifierPath,
  emailPath: provider.emailPath,
  usernamePath: provider.usernamePath,
  nameFirstPath: provider.nameFirstPath,
  nameLastPath: provider.nameLastPath,
  enabled: provider.enabled,
  loginOnly: provider.loginOnly,
  loginBypassTwoFactor: provider.loginBypassTwoFactor,
  linkViewable: provider.linkViewable,
  userManageable: provider.userManageable,
  basicAuth: provider.basicAuth,
});

export function useOAuthProviderFormFields(isUpdate: boolean): {
  fieldsTop: FieldDef<OAuthFormValues>[];
  fieldsMain: FieldDef<OAuthFormValues>[];
} {
  const { t } = useTranslations();

  const fieldsTop: FieldDef<OAuthFormValues>[] = [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}) },
  ];

  const fieldsMain: FieldDef<OAuthFormValues>[] = [
    {
      type: 'text',
      name: 'clientId',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.clientId', {}),
      required: true,
    },
    {
      type: 'password',
      name: 'clientSecret',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.clientSecret', {}),
      props: { withAsterisk: !isUpdate },
    },
    {
      type: 'text',
      name: 'authUrl',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.authUrl', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'tokenUrl',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.tokenUrl', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'infoUrl',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.infoUrl', {}),
      required: true,
    },
    {
      type: 'switch',
      name: 'basicAuth',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.basicAuth', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.basicAuthDescription', {}),
    },
    {
      type: 'tags',
      name: 'scopes',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.scopes', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.scopesDescription', {}),
    },
    {
      type: 'text',
      name: 'identifierPath',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.identifierPath', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.identifierPathDescription', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'emailPath',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.emailPath', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.emailPathDescription', {}),
    },
    {
      type: 'text',
      name: 'usernamePath',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.usernamePath', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.usernamePathDescription', {}),
    },
    {
      type: 'text',
      name: 'nameFirstPath',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.nameFirstPath', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.nameFirstPathDescription', {}),
      props: { placeholder: t('pages.admin.oAuthProviders.tabs.general.page.form.nameFirstPathPlaceholder', {}) },
    },
    {
      type: 'text',
      name: 'nameLastPath',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.nameLastPath', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.nameLastPathDescription', {}),
    },
    {
      type: 'switch',
      name: 'loginOnly',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.loginOnly', {}),
    },
    {
      type: 'switch',
      name: 'loginBypassTwoFactor',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.loginBypassTwoFactor', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.loginBypassTwoFactorDescription', {}),
    },
    {
      type: 'switch',
      name: 'linkViewable',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.linkViewable', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.linkViewableDescription', {}),
    },
    {
      type: 'switch',
      name: 'userManageable',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.userManageable', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.userManageableDescription', {}),
    },
    { type: 'switch', name: 'enabled', label: t('common.form.enabled', {}) },
  ];

  return { fieldsTop, fieldsMain };
}
