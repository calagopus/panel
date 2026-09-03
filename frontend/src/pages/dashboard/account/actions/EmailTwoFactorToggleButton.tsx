import { useModalsStack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { FormEvent, useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import disableEmailTwoFactor from '@/api/me/account/disableEmailTwoFactor.ts';
import enableEmailTwoFactor from '@/api/me/account/enableEmailTwoFactor.ts';
import Button from '@/elements/buttons/Button.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Code from '@/elements/typography/Code.tsx';
import Text from '@/elements/typography/Text.tsx';
import { withTwoFactorMethod } from '@/lib/auth/twoFactor.ts';
import { dashboardEmailTwoFactorToggleSchema } from '@/lib/schemas/dashboard.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function EmailTwoFactorToggleButton() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();
  const twoFactorAcceptedMethods = useGlobalStore((state) => state.settings.app.twoFactorAcceptedMethods);

  const enabled = Boolean(user?.emailTwoFactorEnabled);

  const stageStack = useModalsStack(['toggle', 'recovery']);

  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const form = useForm<z.infer<typeof dashboardEmailTwoFactorToggleSchema>>({
    initialValues: {
      password: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(
      dashboardEmailTwoFactorToggleSchema.extend({
        password: user?.hasPassword
          ? z.string().min(1, t('common.form.passwordRequired', {})).max(512)
          : z.string().max(512),
      }),
    ),
  });

  useEffect(() => {
    if (!stageStack.state.toggle) {
      setRecoveryCodes([]);
      form.reset();
    }
  }, [stageStack.state.toggle]);

  const doEnable = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    enableEmailTwoFactor({
      ...form.values,
      password: user?.hasPassword ? form.values.password : 'aaa',
    })
      .then(({ recoveryCodes }) => {
        setRecoveryCodes(recoveryCodes);
        stageStack.open('recovery');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const doDisable = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    disableEmailTwoFactor({
      ...form.values,
      password: user?.hasPassword ? form.values.password : 'aaa',
    })
      .then(() => {
        addToast(t('pages.account.account.containers.emailTwoFactor.toast.disabled', {}), 'success');
        stageStack.closeAll();
        setUser({
          ...withTwoFactorMethod(user!, twoFactorAcceptedMethods, 'email', false),
          emailTwoFactorEnabled: false,
        });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const markEnabled = () => {
    setUser({ ...withTwoFactorMethod(user!, twoFactorAcceptedMethods, 'email', true), emailTwoFactorEnabled: true });
  };

  return (
    <>
      <Modal.Stack>
        <FormModal
          {...stageStack.register('toggle')}
          title={
            enabled
              ? t('pages.account.account.containers.emailTwoFactor.modal.disable.title', {})
              : t('pages.account.account.containers.emailTwoFactor.modal.enable.title', {})
          }
          loading={loading}
          onSubmit={enabled ? doDisable : doEnable}
        >
          <Stack>
            <Text>
              {enabled
                ? t('pages.account.account.containers.emailTwoFactor.modal.disable.description', {}).md()
                : t('pages.account.account.containers.emailTwoFactor.modal.enable.description', {
                    email: user?.email ?? '',
                  }).md()}
            </Text>

            {user?.hasPassword && (
              <PasswordInput
                withAsterisk
                label={t('common.form.password', {})}
                autoComplete='current-password'
                {...form.getInputProps('password')}
              />
            )}

            <ModalFooter>
              <Button color={enabled ? 'red' : undefined} type='submit' loading={loading} disabled={!form.isValid()}>
                {enabled ? t('common.button.disable', {}) : t('common.button.enable', {})}
              </Button>
              <Button variant='default' onClick={() => stageStack.closeAll()}>
                {t('common.button.close', {})}
              </Button>
            </ModalFooter>
          </Stack>
        </FormModal>
        <Modal
          {...stageStack.register('recovery')}
          onClose={() => {
            markEnabled();
            stageStack.closeAll();
          }}
          title={t('pages.account.account.containers.twoFactor.modal.recoveryCodes.title', {})}
        >
          <Stack>
            <Text>{t('pages.account.account.containers.twoFactor.modal.recoveryCodes.description', {})}</Text>

            <CopyOnClick content={recoveryCodes.join('\n')}>
              <Code block className='grid grid-cols-2 w-full gap-x-2'>
                {recoveryCodes.map((code, i) => (
                  <span key={code} className={i % 2 === 0 ? 'text-right' : 'text-left'}>
                    {code}
                  </span>
                ))}
              </Code>
            </CopyOnClick>

            <ModalFooter>
              <Button
                variant='default'
                onClick={() => {
                  markEnabled();
                  stageStack.closeAll();
                }}
              >
                {t('common.button.close', {})}
              </Button>
            </ModalFooter>
          </Stack>
        </Modal>
      </Modal.Stack>

      <Button color={enabled ? 'red' : undefined} onClick={() => stageStack.open('toggle')}>
        {enabled
          ? t('pages.account.account.containers.twoFactor.button.disableEmail', {})
          : t('pages.account.account.containers.twoFactor.button.enableEmail', {})}
      </Button>
    </>
  );
}
