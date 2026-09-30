import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import MultiKeyValueInput from '@/elements/input/MultiKeyValueInput.tsx';
import { ignorePasswordManagerProps } from '@/lib/passwordManager.ts';
import { adminBackupConfigurationKopiaSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BackupProviderSection from './BackupProviderSection.tsx';

type KopiaFormValues = z.infer<typeof adminBackupConfigurationKopiaSchema>;

export default function BackupKopia({
  form,
  onRemove,
}: {
  form: UseFormReturnType<KopiaFormValues>;
  onRemove?: () => void;
}) {
  const { t } = useTranslations();

  const fields: FieldDef<KopiaFormValues>[] = [
    {
      type: 'text',
      name: 'url',
      label: t('pages.admin.backupConfigurations.tabs.general.page.kopia.form.url', {}),
      required: true,
      props: { placeholder: 'https://kopia.example.com:51515' },
    },
    {
      type: 'text',
      name: 'fingerprint',
      label: t('pages.admin.backupConfigurations.tabs.general.page.kopia.form.fingerprint', {}),
      description: t('pages.admin.backupConfigurations.tabs.general.page.kopia.form.fingerprintDescription', {}),
      props: { placeholder: '48537cce...398d40f7' },
    },
    {
      type: 'text',
      name: 'username',
      label: t('common.form.username', {}),
      required: true,
      props: ignorePasswordManagerProps,
    },
    { type: 'password', name: 'password', label: t('common.form.password', {}), required: true },
  ];

  return (
    <BackupProviderSection
      title={t('pages.admin.backupConfigurations.tabs.general.page.kopia.title', {})}
      onRemove={onRemove}
    >
      <FormEngine form={form} fields={fields} />

      <MultiKeyValueInput
        label={t('pages.admin.backupConfigurations.tabs.general.page.kopia.form.tags', {})}
        allowReordering={false}
        options={form.values.tags}
        onChange={(e) => form.setFieldValue('tags', e)}
      />
    </BackupProviderSection>
  );
}
