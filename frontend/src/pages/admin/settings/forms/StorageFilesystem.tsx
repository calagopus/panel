import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/Stack.tsx';
import { adminSettingsStorageFilesystemSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type FilesystemValues = z.infer<typeof adminSettingsStorageFilesystemSchema>;

export default function StorageFilesystem({ form }: { form: UseFormReturnType<FilesystemValues> }) {
  const { t } = useTranslations();
  const { formExtension } = useFormExtensions('admin.settings.storage.filesystem');

  useEffect(() => {
    form.setValues({ path: form.values.path ?? '' });
  }, []);

  const fields: FieldDef<FilesystemValues>[] = [
    {
      type: 'text',
      name: 'path',
      label: t('common.form.path', {}),
      required: true,
      colSpan: 'full',
    },
  ];

  return (
    <Stack mt='md'>
      <FormEngine form={form} fields={fields} extensions={[formExtension]} />
    </Stack>
  );
}
