import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/Stack.tsx';
import { adminSettingsEmailSmtpSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type SmtpValues = z.infer<typeof adminSettingsEmailSmtpSchema>;

export default function EmailSmtp({ form }: { form: UseFormReturnType<SmtpValues> }) {
  const { t } = useTranslations();
  useEffect(() => {
    form.setValues({
      host: form.values.host ?? '',
      port: form.values.port ?? 587,
      username: form.values.username ?? null,
      password: form.values.password ?? null,
      tlsMode: form.values.tlsMode ?? 'start_tls',
      skipCertValidation: form.values.skipCertValidation ?? false,
      fromAddress: form.values.fromAddress ?? '',
      fromName: form.values.fromName ?? null,
    });
  }, []);

  const fields: FieldDef<SmtpValues>[] = [
    {
      type: 'text',
      name: 'host',
      label: t('common.form.host', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'port',
      label: t('common.form.port', {}),
      required: true,
      props: { min: 0 },
    },
    {
      type: 'select',
      name: 'tlsMode',
      label: t('pages.admin.settings.tabs.mail.page.smtp.form.tlsMode', {}),
      required: true,
      options: [
        { value: 'none', label: t('pages.admin.settings.tabs.mail.page.enum.tlsMode.none', {}) },
        { value: 'start_tls', label: t('pages.admin.settings.tabs.mail.page.enum.tlsMode.startTls', {}) },
        { value: 'implicit_tls', label: t('pages.admin.settings.tabs.mail.page.enum.tlsMode.implicitTls', {}) },
      ],
    },
    {
      type: 'switch',
      name: 'skipCertValidation',
      label: t('pages.admin.settings.tabs.mail.page.smtp.form.skipCertValidation', {}),
    },
    {
      type: 'text',
      name: 'username',
      label: t('common.form.username', {}),
    },
    {
      type: 'password',
      name: 'password',
      label: t('common.form.password', {}),
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
      <FormEngine id='admin.settings.email.smtp' form={form} fields={fields} />
    </Stack>
  );
}
