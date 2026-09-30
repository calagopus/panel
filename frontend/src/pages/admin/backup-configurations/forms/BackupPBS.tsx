import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import { ignorePasswordManagerProps } from '@/lib/passwordManager.ts';
import { adminBackupConfigurationPbsSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BackupProviderSection from './BackupProviderSection.tsx';

type PbsFormValues = z.infer<typeof adminBackupConfigurationPbsSchema>;

export default function BackupPBS({
  form,
  onRemove,
}: {
  form: UseFormReturnType<PbsFormValues>;
  onRemove?: () => void;
}) {
  const { t } = useTranslations();

  const fields: FieldDef<PbsFormValues>[] = [
    {
      type: 'text',
      name: 'url',
      label: t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.url', {}),
      required: true,
      props: { placeholder: 'https://pbs.example.com:8007' },
    },
    {
      type: 'text',
      name: 'datastore',
      label: t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.datastore', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'tokenId',
      label: t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.tokenId', {}),
      required: true,
      props: { placeholder: 'root@pam!mytoken', ...ignorePasswordManagerProps },
    },
    {
      type: 'password',
      name: 'tokenSecret',
      label: t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.tokenSecret', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'fingerprint',
      label: t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.fingerprint', {}),
      description: t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.fingerprintDescription', {}),
    },
    {
      type: 'text',
      name: 'namespace',
      label: t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.namespace', {}),
    },
    {
      type: 'text',
      name: 'backupIdPrefix',
      label: t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.backupIdPrefix', {}),
      props: { placeholder: 'calagopus' },
    },
  ];

  return (
    <BackupProviderSection
      title={t('pages.admin.backupConfigurations.tabs.general.page.pbs.title', {})}
      onRemove={onRemove}
    >
      <FormEngine form={form} fields={fields} />
    </BackupProviderSection>
  );
}
