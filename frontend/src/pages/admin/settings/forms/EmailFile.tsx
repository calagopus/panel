import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/Stack.tsx';
import { adminSettingsEmailFilesystemSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type EmailFileValues = z.infer<typeof adminSettingsEmailFilesystemSchema>;

export default function EmailFile({ form }: { form: UseFormReturnType<EmailFileValues> }) {
  const { t } = useTranslations();
  useEffect(() => {
    form.setValues({
      path: form.values.path ?? '',
      fromAddress: form.values.fromAddress ?? '',
      fromName: form.values.fromName ?? null,
    });
  }, []);

  const fields: FieldDef<EmailFileValues>[] = [
    {
      type: 'text',
      name: 'path',
      label: t('common.form.path', {}),
      required: true,
      colSpan: 'full',
    },
    {
      type: 'text',
      name: 'fromAddress',
      label: t('common.form.fromAddress', {}),
      required: true,
    },
    {
      type: 'text',
      name: 'fromName',
      label: t('common.form.fromName', {}),
    },
  ];

  return (
    <Stack mt='md'>
      <FormEngine id='admin.settings.email.file' form={form} fields={fields} />
    </Stack>
  );
}
