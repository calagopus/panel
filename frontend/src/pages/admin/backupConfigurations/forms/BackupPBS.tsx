import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Divider from '@/elements/Divider.tsx';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/Stack.tsx';
import Title from '@/elements/Title.tsx';
import { adminBackupConfigurationPbsSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type PbsFormValues = z.infer<typeof adminBackupConfigurationPbsSchema>;

export default function BackupPBS({ form }: { form: UseFormReturnType<PbsFormValues> }) {
  const { t } = useTranslations();
  const { formExtension } = useFormExtensions('admin.backupConfigurations.pbs');

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
      props: { placeholder: 'root@pam!mytoken' },
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
      required: true,
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
    <Stack gap='xs' mt='md'>
      <Stack gap={0}>
        <Title order={2}>{t('pages.admin.backupConfigurations.tabs.general.page.pbs.title', {})}</Title>
        <Divider />
      </Stack>

      <FormEngine form={form} fields={fields} extensions={[formExtension]} />
    </Stack>
  );
}
