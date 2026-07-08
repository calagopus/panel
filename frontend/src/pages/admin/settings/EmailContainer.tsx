import { UseFormReturnType, useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import updateEmailSettings from '@/api/admin/settings/updateEmailSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import Select from '@/elements/input/Select.tsx';
import { mailModeTypeLabelMapping } from '@/lib/enums.ts';
import {
  adminSettingsEmailFilesystemSchema,
  adminSettingsEmailSchema,
  adminSettingsEmailSendmailSchema,
  adminSettingsEmailSmtpSchema,
} from '@/lib/schemas/admin/settings.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import EmailFile from './forms/EmailFile.tsx';
import EmailSendmail from './forms/EmailSendmail.tsx';
import EmailSmtp from './forms/EmailSmtp.tsx';
import EmailSendTestModal from './modals/EmailSendTestModal.tsx';

export default function EmailContainer() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const mailMode = useAdminStore((state) => state.mailMode);
  const updateSettings = useAdminStore((state) => state.updateSettings);

  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState<'sendTestEmail' | null>(null);

  const form = useForm<z.infer<typeof adminSettingsEmailSchema>>({
    initialValues: {
      type: 'none',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsEmailSchema),
  });

  useEffect(() => {
    form.setValues<z.infer<typeof adminSettingsEmailSchema>>({
      ...mailMode,
    });
  }, [mailMode]);

  const doUpdate = () => {
    setLoading(true);
    updateEmailSettings(adminSettingsEmailSchema.parse(form.getValues()))
      .then(() => {
        addToast(t('pages.admin.settings.tabs.mail.page.toast.updated', {}), 'success');
        updateSettings({ mailMode: adminSettingsEmailSchema.parse(form.getValues()) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminSubContentContainer title={t('pages.admin.settings.tabs.mail.page.title', {})} titleOrder={2}>
      <EmailSendTestModal opened={openModal === 'sendTestEmail'} onClose={() => setOpenModal(null)} />

      <form onSubmit={form.onSubmit(() => doUpdate())}>
        <Select
          label={t('common.form.provider', {})}
          data={Object.entries(mailModeTypeLabelMapping).map(([value, label]) => ({
            value,
            label: label(),
          }))}
          key={form.key('type')}
          {...form.getInputProps('type')}
        />

        {form.getValues().type === 'smtp' ? (
          <EmailSmtp form={form as UseFormReturnType<z.infer<typeof adminSettingsEmailSmtpSchema>>} />
        ) : form.getValues().type === 'sendmail' ? (
          <EmailSendmail form={form as UseFormReturnType<z.infer<typeof adminSettingsEmailSendmailSchema>>} />
        ) : form.getValues().type === 'filesystem' ? (
          <EmailFile form={form as UseFormReturnType<z.infer<typeof adminSettingsEmailFilesystemSchema>>} />
        ) : null}

        <Group mt='md'>
          <AdminCan action='settings.update' cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
          </AdminCan>
          <AdminCan action='settings.read'>
            <Button variant='outline' loading={loading} onClick={() => setOpenModal('sendTestEmail')}>
              {t('common.button.sendTestEmail', {})}
            </Button>
          </AdminCan>
        </Group>
      </form>
    </AdminSubContentContainer>
  );
}
