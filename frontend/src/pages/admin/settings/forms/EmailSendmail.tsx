import { Group, Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminSettingsEmailSendmailSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EmailSendmail({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof adminSettingsEmailSendmailSchema>>;
}) {
  const { t } = useTranslations();

  useEffect(() => {
    form.setValues({
      command: form.values.command ?? 'sendmail',
      fromAddress: form.values.fromAddress ?? '',
      fromName: form.values.fromName ?? null,
    });
  }, []);

  return (
    <Stack mt='md'>
      <TextInput label={t('common.form.command', {})} key={form.key('command')} {...form.getInputProps('command')} />

      <Group grow>
        <TextInput withAsterisk label={t('common.form.fromAddress', {})} {...form.getInputProps('fromAddress')} />
        <TextInput
          label={t('common.form.fromName', {})}
          key={form.key('fromName')}
          {...form.getInputProps('fromName')}
        />
      </Group>
    </Stack>
  );
}
