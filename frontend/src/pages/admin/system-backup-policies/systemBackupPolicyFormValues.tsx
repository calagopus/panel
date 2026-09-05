import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import CronInput from '@/elements/input/CronInput.tsx';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import {
  adminSystemBackupPolicySchema,
  adminSystemBackupPolicyUpdateSchema,
} from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type SystemBackupPolicyFormValues = z.infer<typeof adminSystemBackupPolicyUpdateSchema>;

export const systemBackupPolicyEmptyFormValues: SystemBackupPolicyFormValues = {
  name: '',
  description: null,
  backupConfigurationUuid: null,
  enabled: true,
  cron: '0 0 0 * * *',
  retentionCount: null,
  retentionDays: null,
  parallelism: 2,
};

export const systemBackupPolicyToFormValues = (
  policy: z.infer<typeof adminSystemBackupPolicySchema>,
): Partial<SystemBackupPolicyFormValues> => ({
  name: policy.name,
  description: policy.description,
  backupConfigurationUuid: policy.backupConfiguration?.uuid ?? null,
  enabled: policy.enabled,
  cron: policy.cron,
  retentionCount: policy.retentionCount,
  retentionDays: policy.retentionDays,
  parallelism: policy.parallelism,
});

export function useSystemBackupPolicyFormFields({
  backupConfigurations,
  canReadBackupConfigurations,
}: {
  backupConfigurations: ReturnType<typeof useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>>;
  canReadBackupConfigurations: boolean;
}): FieldDef<SystemBackupPolicyFormValues>[] {
  const { t } = useTranslations();

  return [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'select',
      name: 'backupConfigurationUuid',
      label: t('common.form.backupConfiguration', {}),
      options: backupConfigurations.items.map((b) => ({ label: b.name, value: b.uuid })),
      props: {
        placeholder: t('pages.admin.systemBackupPolicies.form.backupConfigurationPlaceholder', {}),
        searchable: true,
        searchValue: backupConfigurations.search,
        onSearchChange: backupConfigurations.setSearch,
        allowDeselect: true,
        clearable: true,
        disabled: !canReadBackupConfigurations,
        loading: backupConfigurations.loading,
      },
    },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3, colSpan: 'full' },
    {
      type: 'custom',
      name: 'cron',
      render: (form) => {
        const inputProps = form.getInputProps('cron');

        return (
          <CronInput
            label={t('pages.admin.systemBackupPolicies.form.cron', {})}
            description={t('pages.admin.systemBackupPolicies.form.cronDescription', {})}
            required
            placeholder='0 0 0 * * *'
            value={form.values.cron}
            onChange={inputProps.onChange}
            onBlur={inputProps.onBlur}
            error={inputProps.error}
          />
        );
      },
    },
    {
      type: 'number',
      name: 'parallelism',
      label: t('pages.admin.systemBackupPolicies.form.parallelism', {}),
      description: t('pages.admin.systemBackupPolicies.form.parallelismDescription', {}),
      required: true,
      props: { min: 1, max: 100, allowDecimal: false },
    },
    {
      type: 'number',
      name: 'retentionCount',
      label: t('pages.admin.systemBackupPolicies.form.retentionCount', {}),
      description: t('pages.admin.systemBackupPolicies.form.retentionCountDescription', {}),
      props: { min: 1, allowDecimal: false },
    },
    {
      type: 'number',
      name: 'retentionDays',
      label: t('pages.admin.systemBackupPolicies.form.retentionDays', {}),
      description: t('pages.admin.systemBackupPolicies.form.retentionDaysDescription', {}),
      props: { min: 1, allowDecimal: false },
    },
    {
      type: 'switch',
      name: 'enabled',
      label: t('common.form.enabled', {}),
      description: t('pages.admin.systemBackupPolicies.form.enabledDescription', {}),
    },
  ];
}
