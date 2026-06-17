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

  return (
    <Stack gap='xs' mt='md'>
      <Stack gap={0}>
        <Title order={2}>{t('pages.admin.backupConfigurations.tabs.general.page.pbs.title', {})}</Title>
        <Divider />
      </Stack>

      <Stack>
        <Group grow>
          <TextInput
            withAsterisk
            label={t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.url', {})}
            placeholder='https://pbs.example.com:8007'
            key={form.key('url')}
            {...form.getInputProps('url')}
          />
          <TextInput
            withAsterisk
            label={t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.datastore', {})}
            key={form.key('datastore')}
            {...form.getInputProps('datastore')}
          />
        </Group>

        <Group grow>
          <TextInput
            withAsterisk
            label={t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.tokenId', {})}
            placeholder='root@pam!mytoken'
            key={form.key('tokenId')}
            {...form.getInputProps('tokenId')}
          />
          <PasswordInput
            withAsterisk
            label={t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.tokenSecret', {})}
            key={form.key('tokenSecret')}
            {...form.getInputProps('tokenSecret')}
          />
        </Group>

        <Group grow>
          <TextInput
            withAsterisk
            label={t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.fingerprint', {})}
            key={form.key('fingerprint')}
            {...form.getInputProps('fingerprint')}
          />
          <TextInput
            label={t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.namespace', {})}
            key={form.key('namespace')}
            {...form.getInputProps('namespace')}
          />
        </Group>

        <Group grow>
          <TextInput
            label={t('pages.admin.backupConfigurations.tabs.general.page.pbs.form.backupIdPrefix', {})}
            placeholder='calagopus'
            key={form.key('backupIdPrefix')}
            {...form.getInputProps('backupIdPrefix')}
          />
        </Group>
      </Stack>
    </Stack>
  );
}
