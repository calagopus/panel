import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import { adminSettingsUserSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type UserSettingsFormValues = z.infer<typeof adminSettingsUserSchema>;

export const userSettingsEmptyFormValues: UserSettingsFormValues = {
  maxServerGroupCount: 0,
  maxApiKeyCount: 0,
  maxCommandSnippetCount: 0,
  maxSecurityKeyCount: 0,
  maxSshKeyCount: 0,
  maxSettingsCount: 0,
  maxSettingsValueBytes: 0,
  maxTeamCount: 0,
  maxTeamMemberCount: 0,
  maxTeamPresetCount: 0,
  allowChangingLanguage: true,
  allowChangingAvatar: true,
  allowCreatingTeams: true,
  routeOrder: null,
};

export const userSettingsToFormValues = (user: UserSettingsFormValues): Partial<UserSettingsFormValues> => ({
  ...user,
});

export function useUserSettingsFormFields(): FieldDef<UserSettingsFormValues>[] {
  const { t } = useTranslations();

  return [
    {
      type: 'divider',
      name: 'limitsDivider',
      label: t('pages.admin.settings.tabs.user.page.section.limits', {}),
    },
    {
      type: 'number',
      name: 'maxServerGroupCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxServerGroupCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxApiKeyCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxApiKeyCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxCommandSnippetCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxCommandSnippetCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxSecurityKeyCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxSecurityKeyCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxSshKeyCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxSshKeyCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxSettingsCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxSettingsCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxSettingsValueBytes',
      label: t('pages.admin.settings.tabs.user.page.form.maxSettingsValueBytes', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxTeamCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxTeamCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxTeamMemberCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxTeamMemberCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxTeamPresetCount',
      label: t('pages.admin.settings.tabs.user.page.form.maxTeamPresetCount', {}),
      required: true,
    },
    {
      type: 'divider',
      name: 'permissionsDivider',
      label: t('pages.admin.settings.tabs.user.page.section.permissions', {}),
    },
    {
      type: 'switch',
      name: 'allowChangingLanguage',
      label: t('pages.admin.settings.tabs.user.page.form.allowChangingLanguage', {}),
      description: t('pages.admin.settings.tabs.user.page.form.allowChangingLanguageDescription', {}),
    },
    {
      type: 'switch',
      name: 'allowChangingAvatar',
      label: t('pages.admin.settings.tabs.user.page.form.allowChangingAvatar', {}),
      description: t('pages.admin.settings.tabs.user.page.form.allowChangingAvatarDescription', {}),
    },
    {
      type: 'switch',
      name: 'allowCreatingTeams',
      label: t('pages.admin.settings.tabs.user.page.form.allowCreatingTeams', {}),
      description: t('pages.admin.settings.tabs.user.page.form.allowCreatingTeamsDescription', {}),
    },
  ];
}
