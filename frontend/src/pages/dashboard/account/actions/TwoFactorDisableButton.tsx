import { Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import disableTwoFactor from '@/api/me/account/disableTwoFactor.ts';
import Button from '@/elements/Button.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { dashboardTwoFactorDisableSchema } from '@/lib/schemas/dashboard.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function TwoFactorDisableButton() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();

  const [openModal, setOpenModal] = useState<'disable' | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof dashboardTwoFactorDisableSchema>>({
    initialValues: {
      code: '',
      password: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(dashboardTwoFactorDisableSchema),
  });

  useEffect(() => {
    if (!openModal) {
      form.reset();
      return;
    }
  }, [openModal]);

  const doDisable = () => {
    setLoading(true);

    disableTwoFactor(form.values)
      .then(() => {
        addToast(t('pages.account.account.containers.twoFactor.toast.disabled', {}), 'success');
        setOpenModal(null);
        setUser({ ...user!, totpEnabled: false });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <>
      <Modal
        title={t('pages.account.account.containers.twoFactor.modal.disableTwoFactor.title', {})}
        onClose={() => setOpenModal(null)}
        opened={openModal === 'disable'}
      >
        <Stack>
          <Text>{t('pages.account.account.containers.twoFactor.modal.disableTwoFactor.description', {}).md()}</Text>

          <TextInput
            withAsterisk
            label={t('pages.account.account.containers.twoFactor.modal.disableTwoFactor.form.code', {})}
            placeholder='000000'
            autoComplete='one-time-code'
            {...form.getInputProps('code')}
          />

          <PasswordInput
            withAsterisk
            label={t('common.form.password', {})}
            placeholder={t('common.form.password', {})}
            autoComplete='current-password'
            {...form.getInputProps('password')}
          />

          <ModalFooter>
            <Button color='red' onClick={doDisable} loading={loading} disabled={!form.isValid()}>
              {t('common.button.disable', {})}
            </Button>
            <Button variant='default' onClick={() => setOpenModal(null)}>
              {t('common.button.close', {})}
            </Button>
          </ModalFooter>
        </Stack>
      </Modal>

      <Button color='red' onClick={() => setOpenModal('disable')}>
        {t('pages.account.account.containers.twoFactor.button.disableTwoFactor', {})}
      </Button>
    </>
  );
}
