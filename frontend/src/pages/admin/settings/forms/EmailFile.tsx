import { Group, Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminSettingsEmailFilesystemSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EmailFile({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof adminSettingsEmailFilesystemSchema>>;
}) {
  const { t } = useTranslations();

  useEffect(() => {
    form.setValues({
      path: form.values.path ?? '',
      fromAddress: form.values.fromAddress ?? '',
      fromName: form.values.fromName ?? null,
    });
  }, []);

  return (
    <Stack mt='md'>
      <TextInput
        withAsterisk
        label={t('common.form.path', {})}
        key={form.key('path')}
        {...form.getInputProps('path')}
      />

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
