import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import Divider from '@/elements/Divider.tsx';
import Group from '@/elements/Group.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import Title from '@/elements/Title.tsx';
import { adminBackupConfigurationPbsSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function BackupPBS({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof adminBackupConfigurationPbsSchema>>;
}) {
  const { t } = useTranslations();

  const prefix = 'pages.admin.backupConfigurations.tabs.general.page.pbs';

  return (
    <Stack gap='xs' mt='md'>
      <Stack gap={0}>
        <Title order={2}>{t(`${prefix}.title`, {})}</Title>
        <Divider />
      </Stack>

      <Stack>
        <Group grow>
          <TextInput
            withAsterisk
            label={t(`${prefix}.form.url`, {})}
            placeholder='https://pbs.example.com:8007'
            key={form.key('url')}
            {...form.getInputProps('url')}
          />
          <TextInput
            withAsterisk
            label={t(`${prefix}.form.datastore`, {})}
            key={form.key('datastore')}
            {...form.getInputProps('datastore')}
          />
        </Group>

        <Group grow>
          <TextInput
            withAsterisk
            label={t('common.form.username', {})}
            placeholder='root@pam'
            key={form.key('username')}
            {...form.getInputProps('username')}
          />
          <TextInput
            withAsterisk
            label={t(`${prefix}.form.tokenName`, {})}
            key={form.key('tokenName')}
            {...form.getInputProps('tokenName')}
          />
        </Group>

        <Group grow>
          <PasswordInput
            withAsterisk
            label={t(`${prefix}.form.tokenSecret`, {})}
            key={form.key('tokenSecret')}
            {...form.getInputProps('tokenSecret')}
          />
          <TextInput
            withAsterisk
            label={t(`${prefix}.form.fingerprint`, {})}
            key={form.key('fingerprint')}
            {...form.getInputProps('fingerprint')}
          />
        </Group>

        <Group grow>
          <TextInput
            label={t(`${prefix}.form.namespace`, {})}
            key={form.key('namespace')}
            {...form.getInputProps('namespace')}
          />
          <TextInput
            label={t(`${prefix}.form.backupIdPrefix`, {})}
            placeholder='calagopus'
            key={form.key('backupIdPrefix')}
            {...form.getInputProps('backupIdPrefix')}
          />
        </Group>
      </Stack>
    </Stack>
  );
}
