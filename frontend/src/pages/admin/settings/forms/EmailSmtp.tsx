import { Group, Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import NumberInput from '@/elements/input/NumberInput.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
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
      useTls: form.values.useTls ?? true,
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
          placeholder={t('common.form.host', {})}
          key={form.key('host')}
          {...form.getInputProps('host')}
        />
        <NumberInput
          withAsterisk
          label={t('common.form.port', {})}
          placeholder={t('common.form.port', {})}
          min={0}
          key={form.key('port')}
          {...form.getInputProps('port')}
        />
      </Group>

      <Group grow>
        <Switch
          label={t('pages.admin.settings.tabs.mail.page.smtp.form.useTls', {})}
          key={form.key('useTls')}
          {...form.getInputProps('useTls', { type: 'checkbox' })}
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
          placeholder={t('common.form.username', {})}
          key={form.key('username')}
          {...form.getInputProps('username')}
        />
        <PasswordInput
          label={t('common.form.password', {})}
          placeholder={t('common.form.password', {})}
          key={form.key('password')}
          {...form.getInputProps('password')}
        />
      </Group>

      <Group grow>
        <TextInput
          withAsterisk
          label={t('common.form.fromAddress', {})}
          placeholder={t('common.form.fromAddress', {})}
          key={form.key('fromAddress')}
          {...form.getInputProps('fromAddress')}
        />
        <TextInput
          label={t('common.form.fromName', {})}
          placeholder={t('common.form.fromName', {})}
          key={form.key('fromName')}
          {...form.getInputProps('fromName')}
        />
      </Group>
    </Stack>
  );
}
