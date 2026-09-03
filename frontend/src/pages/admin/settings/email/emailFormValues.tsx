import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import { adminSettingsEmailSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import type { DiscriminatedVariant } from '../DiscriminatedSettingsForm.tsx';

type EmailFormValues = z.infer<typeof adminSettingsEmailSchema>;
type MailMode = EmailFormValues['type'];

export const emailEmptyFormValues: EmailFormValues = { type: 'none' };

export const emailToFormValues = (mode: EmailFormValues): Partial<EmailFormValues> => ({ ...mode });

export function useEmailModeVariants(): Partial<Record<MailMode, DiscriminatedVariant<EmailFormValues>>> {
  const { t } = useTranslations();

  const fromFields: FieldDef<EmailFormValues>[] = [
    { type: 'text', name: 'fromAddress', label: t('common.form.fromAddress', {}), required: true },
    { type: 'text', name: 'fromName', label: t('common.form.fromName', {}) },
  ];

  return {
    smtp: {
      formId: 'admin.settings.email.smtp',
      defaults: {
        host: '',
        port: 587,
        username: null,
        password: null,
        tlsMode: 'start_tls',
        skipCertValidation: false,
        heloDomain: null,
        fromAddress: '',
        fromName: null,
      },
      fields: [
        { type: 'text', name: 'host', label: t('common.form.host', {}), required: true },
        { type: 'number', name: 'port', label: t('common.form.port', {}), required: true, props: { min: 0 } },
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
          name: 'heloDomain',
          label: t('pages.admin.settings.tabs.mail.page.smtp.form.heloDomain', {}),
          description: t('pages.admin.settings.tabs.mail.page.smtp.form.heloDomainDescription', {}),
        },
        { type: 'text', name: 'username', label: t('common.form.username', {}) },
        { type: 'password', name: 'password', label: t('common.form.password', {}) },
        ...fromFields,
      ],
    },
    sendmail: {
      formId: 'admin.settings.email.sendmail',
      defaults: { command: 'sendmail', fromAddress: '', fromName: null },
      fields: [{ type: 'text', name: 'command', label: t('common.form.command', {}), colSpan: 'full' }, ...fromFields],
    },
    filesystem: {
      formId: 'admin.settings.email.file',
      defaults: { path: '', fromAddress: '', fromName: null },
      fields: [
        { type: 'text', name: 'path', label: t('common.form.path', {}), required: true, colSpan: 'full' },
        ...fromFields,
      ],
    },
  };
}
