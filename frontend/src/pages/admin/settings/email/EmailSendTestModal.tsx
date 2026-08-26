import { ModalProps } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import testSystemEmail from '@/api/admin/system/email/testSystemEmail.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminSettingsEmailTestSchema } from '@/lib/schemas/admin/settings.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EmailSendTestModal({ ...props }: ModalProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminSettingsEmailTestSchema>>({
    initialValues: {
      email: user?.email ?? '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminSettingsEmailTestSchema),
  });

  const doSendTestEmail = () => {
    setLoading(true);

    testSystemEmail(form.values.email)
      .then(() => {
        addToast(t('pages.admin.settings.tabs.mail.page.modal.sendTestEmail.toast.sent', {}), 'success');
        props.onClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.settings.tabs.mail.page.modal.sendTestEmail.title', {})} {...props}>
      <form onSubmit={form.onSubmit(() => doSendTestEmail())}>
        <TextInput
          withAsterisk
          label={t('common.form.email', {})}
          placeholder={t('common.form.email', {})}
          {...form.getInputProps('email')}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.sendTestEmail', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
