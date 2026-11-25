import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import { adminSettingsActivitySchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type ActivityFormValues = z.infer<typeof adminSettingsActivitySchema>;

export const activityEmptyFormValues: ActivityFormValues = {
  adminLogRetentionDays: 1,
  adminLogRetentionCount: null,
  userLogRetentionDays: 1,
  userLogRetentionCount: null,
  teamLogRetentionDays: 1,
  teamLogRetentionCount: null,
  serverLogRetentionDays: 1,
  serverLogRetentionCount: null,
  serverLogAdminActivity: false,
  serverLogScheduleActivity: false,
  serverHideActivityIps: 'none',
  teamHideActivityIps: 'none',
};

export const activityToFormValues = (activity: ActivityFormValues): Partial<ActivityFormValues> => ({ ...activity });

export function useActivityFormFields(): FieldDef<ActivityFormValues>[] {
  const { t } = useTranslations();

  return [
    {
      type: 'number',
      name: 'adminLogRetentionDays',
      label: t('pages.admin.settings.tabs.activity.page.form.adminLogRetentionDays', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'adminLogRetentionCount',
      label: t('pages.admin.settings.tabs.activity.page.form.adminLogRetentionCount', {}),
    },
    {
      type: 'number',
      name: 'userLogRetentionDays',
      label: t('pages.admin.settings.tabs.activity.page.form.userLogRetentionDays', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'userLogRetentionCount',
      label: t('pages.admin.settings.tabs.activity.page.form.userLogRetentionCount', {}),
    },
    {
      type: 'number',
      name: 'teamLogRetentionDays',
      label: t('pages.admin.settings.tabs.activity.page.form.teamLogRetentionDays', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'teamLogRetentionCount',
      label: t('pages.admin.settings.tabs.activity.page.form.teamLogRetentionCount', {}),
    },
    {
      type: 'number',
      name: 'serverLogRetentionDays',
      label: t('pages.admin.settings.tabs.activity.page.form.serverLogRetentionDays', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'serverLogRetentionCount',
      label: t('pages.admin.settings.tabs.activity.page.form.serverLogRetentionCount', {}),
    },
    {
      type: 'switch',
      name: 'serverLogAdminActivity',
      label: t('pages.admin.settings.tabs.activity.page.form.serverLogAdminActivity', {}),
      description: t('pages.admin.settings.tabs.activity.page.form.serverLogAdminActivityDescription', {}),
    },
    {
      type: 'switch',
      name: 'serverLogScheduleActivity',
      label: t('pages.admin.settings.tabs.activity.page.form.serverLogScheduleActivity', {}),
      description: t('pages.admin.settings.tabs.activity.page.form.serverLogScheduleActivityDescription', {}),
    },
    {
      type: 'select',
      name: 'serverHideActivityIps',
      label: t('pages.admin.settings.tabs.activity.page.form.serverHideActivityIps', {}),
      description: t('pages.admin.settings.tabs.activity.page.form.serverHideActivityIpsDescription', {}),
      required: true,
      options: [
        { label: t('pages.admin.settings.tabs.activity.page.enum.serverHideActivityIps.admins', {}), value: 'admins' },
        {
          label: t('pages.admin.settings.tabs.activity.page.enum.serverHideActivityIps.allUsers', {}),
          value: 'all_users',
        },
        { label: t('pages.admin.settings.tabs.activity.page.enum.serverHideActivityIps.none', {}), value: 'none' },
      ],
    },
    {
      type: 'select',
      name: 'teamHideActivityIps',
      label: t('pages.admin.settings.tabs.activity.page.form.teamHideActivityIps', {}),
      description: t('pages.admin.settings.tabs.activity.page.form.teamHideActivityIpsDescription', {}),
      required: true,
      options: [
        { label: t('pages.admin.settings.tabs.activity.page.enum.serverHideActivityIps.admins', {}), value: 'admins' },
        {
          label: t('pages.admin.settings.tabs.activity.page.enum.serverHideActivityIps.allUsers', {}),
          value: 'all_users',
        },
        { label: t('pages.admin.settings.tabs.activity.page.enum.serverHideActivityIps.none', {}), value: 'none' },
      ],
    },
  ];
}
