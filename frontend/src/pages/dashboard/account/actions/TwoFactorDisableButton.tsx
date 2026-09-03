import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { FormEvent, useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import disableTwoFactor from '@/api/me/account/disableTwoFactor.ts';
import Button from '@/elements/buttons/Button.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { withTwoFactorMethod } from '@/lib/auth/twoFactor.ts';
import { dashboardTwoFactorDisableSchema } from '@/lib/schemas/dashboard.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function TwoFactorDisableButton() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();
  const twoFactorAcceptedMethods = useGlobalStore((state) => state.settings.app.twoFactorAcceptedMethods);

  const [openModal, setOpenModal] = useState<'disable' | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof dashboardTwoFactorDisableSchema>>({
    initialValues: {
      code: '',
      password: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(
      dashboardTwoFactorDisableSchema.extend({
        password: user?.hasPassword
          ? z.string().min(1, t('common.form.passwordRequired', {})).max(512)
          : z.string().max(512),
      }),
    ),
  });

  useEffect(() => {
    if (!openModal) {
      form.reset();
      return;
    }
  }, [openModal]);

  const doDisable = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    disableTwoFactor({
      ...form.values,
      password: user?.hasPassword ? form.values.password : 'aaa',
    })
      .then(() => {
        addToast(t('pages.account.account.containers.twoFactor.toast.disabled', {}), 'success');
        setOpenModal(null);
        setUser({ ...withTwoFactorMethod(user!, twoFactorAcceptedMethods, 'totp', false), totpEnabled: false });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <>
      <FormModal
        title={t('pages.account.account.containers.twoFactor.modal.disableTwoFactor.title', {})}
        onClose={() => setOpenModal(null)}
        opened={openModal === 'disable'}
        loading={loading}
        onSubmit={doDisable}
      >
        <Stack>
          <Text>{t('pages.account.account.containers.twoFactor.modal.disableTwoFactor.description', {}).md()}</Text>

          <TextInput
            withAsterisk
            label={t('common.form.authenticationCode', {})}
            placeholder='000000'
            autoComplete='one-time-code'
            {...form.getInputProps('code')}
          />

          {user?.hasPassword && (
            <PasswordInput
              withAsterisk
              label={t('common.form.password', {})}
              autoComplete='current-password'
              {...form.getInputProps('password')}
            />
          )}

          <ModalFooter>
            <Button color='red' type='submit' loading={loading} disabled={!form.isValid()}>
              {t('common.button.disable', {})}
            </Button>
            <Button variant='default' onClick={() => setOpenModal(null)}>
              {t('common.button.close', {})}
            </Button>
          </ModalFooter>
        </Stack>
      </FormModal>

      <Button color='red' onClick={() => setOpenModal('disable')}>
        {t('common.button.disableTwoFactor', {})}
      </Button>
    </>
  );
}
