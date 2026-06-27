import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Divider from '@/elements/Divider.tsx';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import MultiKeyValueInput from '@/elements/input/MultiKeyValueInput.tsx';
import Stack from '@/elements/Stack.tsx';
import Title from '@/elements/Title.tsx';
import { adminBackupConfigurationKopiaSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type KopiaFormValues = z.infer<typeof adminBackupConfigurationKopiaSchema>;

export default function BackupKopia({ form }: { form: UseFormReturnType<KopiaFormValues> }) {
  const { t } = useTranslations();
  const { formExtension } = useFormExtensions('admin.backupConfigurations.kopia');

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
      required: true,
      props: { placeholder: '48537cce...398d40f7' },
    },
    { type: 'text', name: 'username', label: t('common.form.username', {}), required: true },
    { type: 'password', name: 'password', label: t('common.form.password', {}), required: true },
  ];

  return (
    <Stack gap='xs' mt='md'>
      <Stack gap={0}>
        <Title order={2}>{t('pages.admin.backupConfigurations.tabs.general.page.kopia.title', {})}</Title>
        <Divider />
      </Stack>

      <FormEngine form={form} fields={fields} extensions={[formExtension]} />

      <MultiKeyValueInput
        label={t('pages.admin.backupConfigurations.tabs.general.page.kopia.form.tags', {})}
        allowReordering={false}
        options={form.values.tags}
        onChange={(e) => form.setFieldValue('tags', e)}
      />
    </Stack>
  );
}
