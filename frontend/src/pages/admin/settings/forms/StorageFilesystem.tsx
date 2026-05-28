import { Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminSettingsStorageFilesystemSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function StorageFilesystem({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof adminSettingsStorageFilesystemSchema>>;
}) {
  const { t } = useTranslations();

  useEffect(() => {
    form.setValues({
      path: form.values.path ?? '',
    });
  }, []);

  return (
    <Stack mt='md'>
      <TextInput
        withAsterisk
        label={t('common.form.path', {})}
        placeholder={t('common.form.path', {})}
        key={form.key('path')}
        {...form.getInputProps('path')}
      />
    </Stack>
  );
}
