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
  serverLogRetentionDays: 1,
  serverLogRetentionCount: null,
  serverLogAdminActivity: false,
  serverLogScheduleActivity: false,
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
  ];
}
