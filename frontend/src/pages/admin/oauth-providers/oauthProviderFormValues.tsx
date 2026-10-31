import { faFingerprint } from '@fortawesome/free-solid-svg-icons';
import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import MultiKeyValueInput from '@/elements/input/MultiKeyValueInput.tsx';
import { ignorePasswordManagerProps } from '@/lib/passwordManager.ts';
import { adminOAuthProviderSchema, adminOAuthProviderUpdateSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type OAuthFormValues = z.infer<typeof adminOAuthProviderUpdateSchema>;

export const oauthProviderEmptyFormValues: OAuthFormValues = {
  name: '',
  description: null,
  icon: null,
  clientId: '',
  clientSecret: null,
  authUrl: '',
  tokenUrl: '',
  infoUrl: '',
  infoUrls: {},
  scopes: [],
  identifierPath: '',
  emailPath: null,
  usernamePath: null,
  nameFirstPath: null,
  nameLastPath: null,
  avatarUrlTemplate: null,
  avatarOverwrite: false,
  enabled: true,
  loginViewable: true,
  loginOnly: false,
  loginBypassTwoFactor: false,
  linkViewable: true,
  apiLinkable: false,
  userManageable: true,
  basicAuth: false,
  pkce: false,
};

export const oauthProviderToFormValues = (
  provider: z.infer<typeof adminOAuthProviderSchema>,
): Partial<OAuthFormValues> => ({
  name: provider.name,
  description: provider.description,
  icon: provider.icon,
  clientId: provider.clientId,
  clientSecret: provider.clientSecret,
  authUrl: provider.authUrl,
  tokenUrl: provider.tokenUrl,
  infoUrl: provider.infoUrl,
  infoUrls: provider.infoUrls,
  scopes: provider.scopes,
  identifierPath: provider.identifierPath,
  emailPath: provider.emailPath,
  usernamePath: provider.usernamePath,
  nameFirstPath: provider.nameFirstPath,
  nameLastPath: provider.nameLastPath,
  avatarUrlTemplate: provider.avatarUrlTemplate,
  avatarOverwrite: provider.avatarOverwrite,
  enabled: provider.enabled,
  loginViewable: provider.loginViewable,
  loginOnly: provider.loginOnly,
  loginBypassTwoFactor: provider.loginBypassTwoFactor,
  linkViewable: provider.linkViewable,
  apiLinkable: provider.apiLinkable,
  userManageable: provider.userManageable,
  basicAuth: provider.basicAuth,
  pkce: provider.pkce,
});

export function useOAuthProviderFormFields(): {
  fieldsTop: FieldDef<OAuthFormValues>[];
  fieldsMain: FieldDef<OAuthFormValues>[];
} {
  const { t } = useTranslations();

  const fieldsTop: FieldDef<OAuthFormValues>[] = [
    {
      type: 'text',
      name: 'name',
      label: t('common.form.name', {}),
      required: true,
      icon: { name: 'icon', label: t('common.form.icon', {}), fallback: faFingerprint },
    },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}) },
  ];

  const fieldsMain: FieldDef<OAuthFormValues>[] = [
    {
      type: 'text',
      name: 'clientId',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.clientId', {}),
      required: true,
      props: ignorePasswordManagerProps,
    },
    {
      type: 'password',
      name: 'clientSecret',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.clientSecret', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.clientSecretDescription', {}),
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
      type: 'custom',
      name: 'infoUrls',
      colSpan: 'full',
      render: (f) => (
        <MultiKeyValueInput
          label={t('pages.admin.oAuthProviders.tabs.general.page.form.infoUrls', {})}
          description={t('pages.admin.oAuthProviders.tabs.general.page.form.infoUrlsDescription', {})}
          options={f.getValues().infoUrls ?? {}}
          onChange={(infoUrls) => f.setFieldValue('infoUrls', infoUrls)}
          placeholderKey='member'
          placeholderValue='https://discord.com/api/users/@me/guilds/123456789012345678/member'
        />
      ),
    },
    {
      type: 'switch',
      name: 'basicAuth',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.basicAuth', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.basicAuthDescription', {}),
    },
    {
      type: 'switch',
      name: 'pkce',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.pkce', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.pkceDescription', {}),
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
      type: 'text',
      name: 'avatarUrlTemplate',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.avatarUrlTemplate', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.avatarUrlTemplateDescription', {
        placeholder: '{$.path}',
        example: '{$.picture}',
      }),
      props: { placeholder: 'https://cdn.example.com/avatars/{$.id}/{$.avatar}.png' },
    },
    {
      type: 'switch',
      name: 'avatarOverwrite',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.avatarOverwrite', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.avatarOverwriteDescription', {}),
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
      name: 'apiLinkable',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.apiLinkable', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.apiLinkableDescription', {}),
    },
    {
      type: 'switch',
      name: 'userManageable',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.userManageable', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.userManageableDescription', {}),
    },
    {
      type: 'switch',
      name: 'loginViewable',
      label: t('pages.admin.oAuthProviders.tabs.general.page.form.loginViewable', {}),
      description: t('pages.admin.oAuthProviders.tabs.general.page.form.loginViewableDescription', {}),
    },
    { type: 'switch', name: 'enabled', label: t('common.form.enabled', {}) },
  ];

  return { fieldsTop, fieldsMain };
}
