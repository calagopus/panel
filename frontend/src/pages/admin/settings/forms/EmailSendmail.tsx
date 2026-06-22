import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/Stack.tsx';
import { adminSettingsEmailSendmailSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type SendmailValues = z.infer<typeof adminSettingsEmailSendmailSchema>;

export default function EmailSendmail({ form }: { form: UseFormReturnType<SendmailValues> }) {
  const { t } = useTranslations();

  useEffect(() => {
    form.setValues({
      command: form.values.command ?? 'sendmail',
      fromAddress: form.values.fromAddress ?? '',
      fromName: form.values.fromName ?? null,
    });
  }, []);

  const fields: FieldDef<SendmailValues>[] = [
    {
      type: 'text',
      name: 'command',
      label: t('common.form.command', {}),
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
      <FormEngine form={form} fields={fields} />
    </Stack>
  );
}
