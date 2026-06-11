import { Group, Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import NumberInput from '@/elements/input/NumberInput.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminSettingsEmailSmtpSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EmailSmtp({ form }: { form: UseFormReturnType<z.infer<typeof adminSettingsEmailSmtpSchema>> }) {
  const { t } = useTranslations();

  useEffect(() => {
    form.setValues({
      host: form.values.host ?? '',
      port: form.values.port ?? 587,
      username: form.values.username ?? null,
      password: form.values.password ?? null,
      tlsMode: form.values.tlsMode ?? 'start_tls',
      fromAddress: form.values.fromAddress ?? '',
      fromName: form.values.fromName ?? null,
    });
  }, []);

  return (
    <Stack mt='md'>
      <Group grow>
        <TextInput
          withAsterisk
          label={t('common.form.host', {})}
          key={form.key('host')}
          {...form.getInputProps('host')}
        />
        <NumberInput
          withAsterisk
          label={t('common.form.port', {})}
          min={0}
          key={form.key('port')}
          {...form.getInputProps('port')}
        />
      </Group>

      <Group grow>
        <Select
          withAsterisk
          label={t('pages.admin.settings.tabs.mail.page.smtp.form.tlsMode', {})}
          data={[
            { value: 'none', label: t('pages.admin.settings.tabs.mail.page.enum.tlsMode.none', {}) },
            { value: 'start_tls', label: t('pages.admin.settings.tabs.mail.page.enum.tlsMode.startTls', {}) },
            { value: 'implicit_tls', label: t('pages.admin.settings.tabs.mail.page.enum.tlsMode.implicitTls', {}) },
          ]}
          key={form.key('tlsMode')}
          {...form.getInputProps('tlsMode')}
        />
        <Switch
          label={t('pages.admin.settings.tabs.mail.page.smtp.form.skipCertValidation', {})}
          key={form.key('skipCertValidation')}
          {...form.getInputProps('skipCertValidation', { type: 'checkbox' })}
        />
      </Group>

      <Group grow>
        <TextInput
          label={t('common.form.username', {})}
          key={form.key('username')}
          {...form.getInputProps('username')}
        />
        <PasswordInput
          label={t('common.form.password', {})}
          key={form.key('password')}
          {...form.getInputProps('password')}
        />
      </Group>

      <Group grow>
        <TextInput
          withAsterisk
          label={t('common.form.fromAddress', {})}
          key={form.key('fromAddress')}
          {...form.getInputProps('fromAddress')}
        />
        <TextInput
          label={t('common.form.fromName', {})}
          key={form.key('fromName')}
          {...form.getInputProps('fromName')}
        />
      </Group>
    </Stack>
  );
}
