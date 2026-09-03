import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import { adminSettingsServerSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type ServerSettingsFormValues = z.infer<typeof adminSettingsServerSchema>;

export const serverSettingsEmptyFormValues: ServerSettingsFormValues = {
  maxFileManagerViewSize: 0,
  maxFileManagerContentSearchSize: 0,
  maxFileManagerSearchResults: 1,
  maxSubuserCount: 0,
  maxScheduleStepCount: 0,
  maxBackupGroupCount: 0,
  maxFirewallRuleCount: 0,
  maxFirewallRuleSourceCount: 0,
  maxTunnelConnectionCount: 0,
  maxTunnelPortCount: 0,
  maxDatabaseInstanceDatabaseCount: 0,
  maxDatabaseInstanceUserCount: 0,
  allowOverwritingCustomDockerImage: false,
  allowViewingInstallationLogs: false,
  allowAcknowledgingInstallationFailure: true,
  allowViewingTransferProgress: false,
  containerPrelude: '',
};

export const serverSettingsToFormValues = (server: ServerSettingsFormValues): Partial<ServerSettingsFormValues> => ({
  ...server,
});

export function useServerSettingsFormFields(): FieldDef<ServerSettingsFormValues>[] {
  const { t } = useTranslations();

  return [
    {
      type: 'size',
      name: 'maxFileManagerViewSize',
      label: t('pages.admin.settings.tabs.server.page.form.maxFileManagerViewSize', {}),
      mode: 'b',
      min: 0,
      required: true,
    },
    {
      type: 'number',
      name: 'maxScheduleStepCount',
      label: t('pages.admin.settings.tabs.server.page.form.maxScheduleStepCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxFirewallRuleCount',
      label: t('pages.admin.settings.tabs.server.page.form.maxFirewallRuleCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxFirewallRuleSourceCount',
      label: t('pages.admin.settings.tabs.server.page.form.maxFirewallRuleSourceCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxTunnelConnectionCount',
      label: t('pages.admin.settings.tabs.server.page.form.maxTunnelConnectionCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxTunnelPortCount',
      label: t('pages.admin.settings.tabs.server.page.form.maxTunnelPortCount', {}),
      required: true,
    },
    {
      type: 'size',
      name: 'maxFileManagerContentSearchSize',
      label: t('pages.admin.settings.tabs.server.page.form.maxFileManagerContentSearchSize', {}),
      mode: 'b',
      min: 0,
      required: true,
    },
    {
      type: 'number',
      name: 'maxFileManagerSearchResults',
      label: t('pages.admin.settings.tabs.server.page.form.maxFileManagerSearchResults', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxSubuserCount',
      label: t('pages.admin.settings.tabs.server.page.form.maxSubuserCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxBackupGroupCount',
      label: t('pages.admin.settings.tabs.server.page.form.maxBackupGroupCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxDatabaseInstanceDatabaseCount',
      label: t('pages.admin.settings.tabs.server.page.form.maxDatabaseInstanceDatabaseCount', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'maxDatabaseInstanceUserCount',
      label: t('pages.admin.settings.tabs.server.page.form.maxDatabaseInstanceUserCount', {}),
      required: true,
    },
    {
      type: 'switch',
      name: 'allowOverwritingCustomDockerImage',
      label: t('pages.admin.settings.tabs.server.page.form.allowOverwritingCustomDockerImage', {}),
      description: t('pages.admin.settings.tabs.server.page.form.allowOverwritingCustomDockerImageDescription', {}),
    },
    {
      type: 'switch',
      name: 'allowViewingInstallationLogs',
      label: t('pages.admin.settings.tabs.server.page.form.allowViewingInstallationLogs', {}),
      description: t('pages.admin.settings.tabs.server.page.form.allowViewingInstallationLogsDescription', {}),
    },
    {
      type: 'switch',
      name: 'allowAcknowledgingInstallationFailure',
      label: t('pages.admin.settings.tabs.server.page.form.allowAcknowledgingInstallationFailure', {}),
      description: t('pages.admin.settings.tabs.server.page.form.allowAcknowledgingInstallationFailureDescription', {}),
    },
    {
      type: 'switch',
      name: 'allowViewingTransferProgress',
      label: t('pages.admin.settings.tabs.server.page.form.allowViewingTransferProgress', {}),
      description: t('pages.admin.settings.tabs.server.page.form.allowViewingTransferProgressDescription', {}),
    },
    {
      type: 'text',
      name: 'containerPrelude',
      label: t('pages.admin.settings.tabs.server.page.form.containerPrelude', {}),
      description: t('pages.admin.settings.tabs.server.page.form.containerPreludeDescription', {}),
      required: true,
    },
  ];
}
