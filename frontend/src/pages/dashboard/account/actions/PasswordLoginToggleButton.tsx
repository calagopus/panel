import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { FormEvent, useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updatePasswordLogin from '@/api/me/account/updatePasswordLogin.ts';
import Button from '@/elements/buttons/Button.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import Text from '@/elements/typography/Text.tsx';
import { dashboardPasswordLoginSchema } from '@/lib/schemas/dashboard.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function PasswordLoginToggleButton() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();

  const disabled = Boolean(user?.passwordLoginDisabled);
  const hasSecurityKey = user!.twoFactorMethods.includes('security_key');

  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof dashboardPasswordLoginSchema>>({
    initialValues: {
      password: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(
      dashboardPasswordLoginSchema.extend({
        password: z.string().min(1, t('common.form.passwordRequired', {})).max(512),
      }),
    ),
  });

  useEffect(() => {
    if (!opened) {
      form.reset();
    }
  }, [opened]);

  const doToggle = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    updatePasswordLogin({ ...form.values, disabled: !disabled })
      .then(() => {
        setUser({ ...user!, passwordLoginDisabled: !disabled });
        addToast(t('pages.account.account.containers.passwordLogin.toast.updated', {}), 'success');
        setOpened(false);
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <FormModal
        title={
          disabled
            ? t('pages.account.account.containers.passwordLogin.modal.enable.title', {})
            : t('pages.account.account.containers.passwordLogin.modal.disable.title', {})
        }
        onClose={() => setOpened(false)}
        opened={opened}
        loading={loading}
        onSubmit={doToggle}
      >
        <Stack>
          <Text>
            {disabled
              ? t('pages.account.account.containers.passwordLogin.modal.enable.description', {}).md()
              : t('pages.account.account.containers.passwordLogin.modal.disable.description', {}).md()}
          </Text>

          <PasswordInput
            withAsterisk
            label={t('common.form.password', {})}
            autoComplete='current-password'
            {...form.getInputProps('password')}
          />

          <ModalFooter>
            <Button color={disabled ? undefined : 'red'} type='submit' loading={loading} disabled={!form.isValid()}>
              {disabled ? t('common.button.enable', {}) : t('common.button.disable', {})}
            </Button>
            <Button variant='default' onClick={() => setOpened(false)}>
              {t('common.button.close', {})}
            </Button>
          </ModalFooter>
        </Stack>
      </FormModal>

      <ConditionalTooltip
        enabled={!disabled && !hasSecurityKey}
        label={t('pages.account.account.containers.passwordLogin.tooltip.needsSecurityKey', {})}
      >
        <Button
          color={disabled ? undefined : 'red'}
          onClick={() => setOpened(true)}
          disabled={!disabled && !hasSecurityKey}
        >
          {disabled ? t('common.button.enable', {}) : t('common.button.disable', {})}
        </Button>
      </ConditionalTooltip>
    </>
  );
}
