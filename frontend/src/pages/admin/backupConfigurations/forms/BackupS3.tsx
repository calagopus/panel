import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Divider from '@/elements/Divider.tsx';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/Stack.tsx';
import Title from '@/elements/Title.tsx';
import { adminBackupConfigurationS3Schema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type S3FormValues = z.infer<typeof adminBackupConfigurationS3Schema>;

export default function BackupS3({ form }: { form: UseFormReturnType<S3FormValues> }) {
  const { t } = useTranslations();

  const fields: FieldDef<S3FormValues>[] = [
    { type: 'text', name: 'accessKey', label: t('common.form.accessKey', {}), required: true },
    {
      type: 'password',
      name: 'secretKey',
      label: t('common.form.secretKey', {}),
      required: true,
    },
    { type: 'text', name: 'bucket', label: t('common.form.bucket', {}), required: true },
    { type: 'text', name: 'region', label: t('common.form.region', {}), required: true },
    { type: 'text', name: 'endpoint', label: t('common.form.endpoint', {}), required: true },
    {
      type: 'size',
      name: 'partSize',
      label: t('pages.admin.backupConfigurations.tabs.general.page.s3.form.partSize', {}),
      required: true,
      mode: 'b',
      min: 0,
    },
    {
      type: 'switch',
      name: 'pathStyle',
      label: t('pages.admin.backupConfigurations.tabs.general.page.s3.form.pathStyle', {}),
    },
  ];

  return (
    <Stack gap='xs' mt='md'>
      <Stack gap={0}>
        <Title order={2}>{t('pages.admin.backupConfigurations.tabs.general.page.s3.title', {})}</Title>
        <Divider />
      </Stack>

      <FormEngine form={form} fields={fields} />
    </Stack>
  );
}
