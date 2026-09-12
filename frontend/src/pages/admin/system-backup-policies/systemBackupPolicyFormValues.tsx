import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import BackupRetentionInput from '@/elements/input/BackupRetentionInput.tsx';
import CronInput from '@/elements/input/CronInput.tsx';
import { serverBackupKindLabelMapping } from '@/lib/enums.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import {
  adminSystemBackupPolicySchema,
  adminSystemBackupPolicyUpdateSchema,
} from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { emptyBackupRetention } from '@/lib/schemas/backupRetention.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type SystemBackupPolicyFormValues = z.infer<typeof adminSystemBackupPolicyUpdateSchema>;

export const systemBackupPolicyEmptyFormValues: SystemBackupPolicyFormValues = {
  name: '',
  description: null,
  backupConfigurationUuid: null,
  enabled: true,
  kind: 'server',
  cron: '0 0 0 * * *',
  retention: { ...emptyBackupRetention },
  parallelism: 2,
};

export const systemBackupPolicyToFormValues = (
  policy: z.infer<typeof adminSystemBackupPolicySchema>,
): Partial<SystemBackupPolicyFormValues> => ({
  name: policy.name,
  description: policy.description,
  backupConfigurationUuid: policy.backupConfiguration?.uuid ?? null,
  enabled: policy.enabled,
  kind: policy.kind,
  cron: policy.cron,
  retention: policy.retention,
  parallelism: policy.parallelism,
});

export function useSystemBackupPolicyFormFields({
  backupConfigurations,
  canReadBackupConfigurations,
  doUpdate,
}: {
  backupConfigurations: ReturnType<typeof useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>>;
  canReadBackupConfigurations: boolean;
  doUpdate: boolean;
}): FieldDef<SystemBackupPolicyFormValues>[] {
  const { t } = useTranslations();

  return [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'select',
      name: 'kind',
      label: t('pages.admin.systemBackupPolicies.form.kind', {}),
      description: doUpdate
        ? t('pages.admin.systemBackupPolicies.form.kindLockedDescription', {})
        : t('pages.admin.systemBackupPolicies.form.kindDescription', {}),
      required: true,
      options: (['server', 'database_instance'] as const).map((kind) => ({
        label: serverBackupKindLabelMapping[kind](),
        value: kind,
      })),
      props: { allowDeselect: false, disabled: doUpdate },
    },
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
      type: 'custom',
      name: 'retention',
      colSpan: 'full',
      render: (f) => (
        <BackupRetentionInput form={f} path='retention' label={t('common.elements.backupRetention.title', {})} />
      ),
    },
    {
      type: 'switch',
      name: 'enabled',
      label: t('common.form.enabled', {}),
      description: t('pages.admin.systemBackupPolicies.form.enabledDescription', {}),
    },
  ];
}
